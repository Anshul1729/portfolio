import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DocumentType = 'report' | 'presentation' | 'summary' | 'faq';

// Cost calculation for Gemini 2.5 Flash
const PRICING = {
  input: 0.075 / 1_000_000,  // $0.075 per 1M input tokens
  output: 0.30 / 1_000_000,  // $0.30 per 1M output tokens
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { documentType, sourceIds, title, additionalInstructions, sessionId } = await req.json();

    if (!documentType || !sourceIds || sourceIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "documentType and sourceIds are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service client for logging usage (bypasses RLS)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all chunks from selected sources
    const { data: chunks, error: chunksError } = await supabase
      .from("source_chunks")
      .select(`
        content, chunk_index,
        sources!inner (id, name, status)
      `)
      .in("source_id", sourceIds)
      .order("chunk_index", { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content found in selected sources" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context from chunks
    // deno-lint-ignore no-explicit-any
    const context = chunks
      .map((c: any) => 
        `[From: ${c.sources?.name || 'Unknown'}]\n${c.content}`
      )
      .join("\n\n---\n\n");

    // Get prompt for document type
    const systemPrompt = getDocumentPrompt(documentType as DocumentType, additionalInstructions);

    console.log(`Generating ${documentType} from ${chunks.length} chunks`);

    // Estimate input tokens
    const userMessage = `Generate a ${documentType} based on the following source material:\n\n${context}`;
    const inputChars = systemPrompt.length + userMessage.length;
    const estimatedInputTokens = Math.ceil(inputChars / 4);

    // Call AI to generate document
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content || "";

    // Extract usage from response if available, otherwise estimate
    const usage = aiData.usage || {};
    const promptTokens = usage.prompt_tokens || estimatedInputTokens;
    const completionTokens = usage.completion_tokens || Math.ceil(generatedContent.length / 4);
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = (promptTokens * PRICING.input) + (completionTokens * PRICING.output);

    // Log AI usage for cost tracking
    await supabaseService
      .from("ai_usage_logs")
      .insert({
        user_id: user.id,
        operation_type: "document_generation",
        model: "google/gemini-2.5-flash",
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost: estimatedCost,
        session_id: sessionId || null,
        metadata: { document_type: documentType, source_ids: sourceIds, chunks_used: chunks.length },
      });

    console.log(`Document generation usage logged: ${totalTokens} tokens, $${estimatedCost.toFixed(6)}`);

    // Save generated document
    // deno-lint-ignore no-explicit-any
    const firstChunk = chunks[0] as any;
    const docTitle = title || generateTitle(documentType as DocumentType, firstChunk?.sources?.name);
    
    const { data: doc, error: docError } = await supabase
      .from("generated_documents")
      .insert({
        user_id: user.id,
        title: docTitle,
        document_type: documentType,
        content: generatedContent,
        source_ids: sourceIds,
      })
      .select()
      .single();

    if (docError) {
      console.error("Failed to save document:", docError);
      return new Response(
        JSON.stringify({ error: "Failed to save document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        document: doc,
        content: generatedContent 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Generate document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getDocumentPrompt(type: DocumentType, additionalInstructions?: string): string {
  const base = {
    report: `You are an expert business report writer. Generate a comprehensive, well-structured report based on the provided source material.

FORMAT:
- Use clear headings and subheadings (markdown format)
- Include an executive summary at the beginning
- Organize content into logical sections
- Include key findings and insights
- Add conclusions and recommendations if appropriate
- Use bullet points for lists
- Cite sources when referencing specific information`,

    presentation: `You are an expert presentation designer. Create a slide outline/deck based on the provided source material.

FORMAT:
- Start with a title slide concept
- Include 8-12 slides with clear headers
- Each slide should have:
  - A clear title
  - 3-5 key bullet points
  - Speaker notes (in italics)
- End with a summary/conclusion slide
- Keep text concise - these are slides, not paragraphs
- Use markdown formatting`,

    summary: `You are an expert at creating executive summaries. Condense the provided source material into a clear, concise summary.

FORMAT:
- Keep it to 1-2 pages maximum
- Start with the main purpose/objective
- Highlight key points and findings
- Include important decisions or action items
- Use bullet points for quick scanning
- End with conclusions or next steps`,

    faq: `You are an expert at creating FAQ documents. Generate a comprehensive Q&A document based on the provided source material.

FORMAT:
- Create 10-20 relevant questions and answers
- Organize by topic/category when possible
- Start with the most common/important questions
- Keep answers clear and concise
- Use markdown formatting (## for questions, paragraphs for answers)
- Include cross-references between related questions`,
  };

  let prompt = base[type];
  
  if (additionalInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}`;
  }

  return prompt;
}

function generateTitle(type: DocumentType, sourceName?: string): string {
  const date = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  const typeLabels = {
    report: 'Report',
    presentation: 'Presentation',
    summary: 'Executive Summary',
    faq: 'FAQ Document',
  };

  if (sourceName) {
    return `${typeLabels[type]} - ${sourceName.replace(/\.[^/.]+$/, "")} - ${date}`;
  }
  
  return `${typeLabels[type]} - ${date}`;
}
