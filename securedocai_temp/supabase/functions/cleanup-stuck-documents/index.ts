import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Documents stuck for more than this duration will be marked as error
const STUCK_THRESHOLD_MINUTES = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const thresholdTime = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    console.log(`Looking for documents stuck since before ${thresholdTime}`);

    // Find documents stuck in processing/pending for too long
    // Check both processing_started_at (if available) and updated_at as fallback
    const { data: stuckDocs, error: fetchError } = await supabase
      .from("sources")
      .select("id, name, status, updated_at, processing_started_at")
      .in("status", ["processing", "pending"])
      .or(`processing_started_at.lt.${thresholdTime},and(processing_started_at.is.null,updated_at.lt.${thresholdTime})`);

    if (fetchError) {
      console.error("Error fetching stuck documents:", fetchError);
      throw fetchError;
    }

    if (!stuckDocs || stuckDocs.length === 0) {
      console.log("No stuck documents found");
      return new Response(
        JSON.stringify({ success: true, message: "No stuck documents found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${stuckDocs.length} stuck document(s)`);

    // Mark each stuck document as error
    const results = [];
    for (const doc of stuckDocs) {
      const startTime = doc.processing_started_at || doc.updated_at;
      const stuckMinutes = Math.round((Date.now() - new Date(startTime).getTime()) / 60000);
      
      console.log(`Marking as error: ${doc.name} (stuck for ${stuckMinutes} minutes)`);

      const { error: updateError } = await supabase
        .from("sources")
        .update({
          status: "error",
          error_message: `Processing timed out after ${stuckMinutes} minutes. Click Reprocess to try again.`,
          processing_progress: null,
          processing_info: null,
        })
        .eq("id", doc.id);

      if (updateError) {
        console.error(`Failed to update ${doc.id}:`, updateError);
        results.push({ id: doc.id, name: doc.name, success: false, error: updateError.message });
      } else {
        results.push({ id: doc.id, name: doc.name, success: true, stuckMinutes });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Cleanup complete: ${successCount}/${stuckDocs.length} documents marked as error`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleaned up ${successCount} stuck document(s)`,
        count: successCount,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
