import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CHUNKS = 10;
const MAX_CONTEXT_CHARS = 8000;

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

    const { chatId, message, sourceIds, sessionId } = await req.json();

    if (!chatId || !message) {
      return new Response(
        JSON.stringify({ error: "chatId and message are required" }),
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

    // Create client with user's auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service client for logging usage (bypasses RLS)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify chat belongs to user
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return new Response(
        JSON.stringify({ error: "Chat not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save user message
    const { error: userMsgError } = await supabase
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        role: "user",
        content: message,
      });

    if (userMsgError) {
      console.error("Failed to save user message:", userMsgError);
    }

    // Get conversation history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Search for relevant chunks
    const relevantChunks = await searchRelevantChunks(
      supabase,
      message,
      sourceIds || chat.selected_source_ids || [],
      user.id
    );

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(relevantChunks);

    // Build messages for AI
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Estimate input tokens (rough: 1 token ≈ 4 chars)
    const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedInputTokens = Math.ceil(inputChars / 4);

    // Call Lovable AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
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
      
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream response back to client
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process stream in background
    (async () => {
      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
            
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }

        // Save assistant response
        const sourcesUsed = relevantChunks.map(c => ({
          source_id: c.source_id,
          source_name: c.source_name,
          chunk_index: c.chunk_index,
        }));

        await supabase
          .from("chat_messages")
          .insert({
            chat_id: chatId,
            role: "assistant",
            content: fullResponse,
            sources_used: sourcesUsed,
          });

        // Auto-rename chat if this is the first message
        if (history && history.length <= 2) {
          const title = message.slice(0, 50) + (message.length > 50 ? "..." : "");
          await supabase
            .from("chats")
            .update({ title })
            .eq("id", chatId);
        }

        // Log AI usage for cost tracking
        const estimatedOutputTokens = Math.ceil(fullResponse.length / 4);
        const totalTokens = estimatedInputTokens + estimatedOutputTokens;
        const estimatedCost = (estimatedInputTokens * PRICING.input) + (estimatedOutputTokens * PRICING.output);

        await supabaseService
          .from("ai_usage_logs")
          .insert({
            user_id: user.id,
            operation_type: "chat",
            model: "google/gemini-2.5-flash",
            prompt_tokens: estimatedInputTokens,
            completion_tokens: estimatedOutputTokens,
            total_tokens: totalTokens,
            estimated_cost: estimatedCost,
            session_id: sessionId || null,
            metadata: { chat_id: chatId, chunks_used: relevantChunks.length },
          });

        console.log(`Chat usage logged: ${totalTokens} tokens, $${estimatedCost.toFixed(6)}`);

        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        console.error("Stream error:", error);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface ChunkResult {
  id: string;
  content: string;
  chunk_index: number;
  source_id: string;
  source_name: string;
  score?: number;
}

async function searchRelevantChunks(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  query: string,
  sourceIds: string[],
  userId: string
): Promise<ChunkResult[]> {
  if (!sourceIds || sourceIds.length === 0) {
    const { data: sources } = await supabase
      .from("sources")
      .select("id")
      .eq("status", "ready")
      .limit(10);
    
    sourceIds = sources?.map((s: { id: string }) => s.id) || [];
  }

  if (sourceIds.length === 0) return [];

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (keywords.length === 0) return [];

  const results: ChunkResult[] = [];
  
  for (const sourceId of sourceIds.slice(0, 5)) {
    const { data: chunks } = await supabase
      .from("source_chunks")
      .select(`
        id, content, chunk_index, source_id,
        sources!inner (name)
      `)
      .eq("source_id", sourceId)
      .limit(MAX_CHUNKS);

    if (chunks) {
      for (const chunk of chunks) {
        const contentLower = chunk.content.toLowerCase();
        const score = keywords.reduce((acc: number, kw: string) => {
          return acc + (contentLower.includes(kw) ? 1 : 0);
        }, 0);
        
        if (score > 0) {
          results.push({
            id: chunk.id,
            content: chunk.content,
            chunk_index: chunk.chunk_index,
            source_id: chunk.source_id,
            source_name: chunk.sources.name,
            score,
          });
        }
      }
    }
  }

  results.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  let totalChars = 0;
  const limited: ChunkResult[] = [];
  for (const chunk of results) {
    if (totalChars + chunk.content.length > MAX_CONTEXT_CHARS) break;
    totalChars += chunk.content.length;
    limited.push(chunk);
    if (limited.length >= MAX_CHUNKS) break;
  }

  console.log(`Found ${limited.length} relevant chunks for query: "${query.slice(0, 50)}..."`);
  return limited;
}

function buildSystemPrompt(chunks: ChunkResult[]): string {
  let prompt = `You are a helpful AI assistant for a company knowledge management system. 
You help users understand and work with their uploaded documents.

`;

  if (chunks.length > 0) {
    prompt += `=== RELEVANT CONTEXT FROM UPLOADED DOCUMENTS ===

`;
    for (const chunk of chunks) {
      prompt += `[Source: ${chunk.source_name}, Section ${chunk.chunk_index + 1}]
${chunk.content}
---

`;
    }
    prompt += `=== END OF CONTEXT ===

`;
  }

  prompt += `INSTRUCTIONS:
1. Answer questions based on the context provided above when available
2. When you use information from a source, cite it as [Source: filename]
3. If the answer is not in the context, say so honestly but try to be helpful
4. Be accurate, helpful, and concise
5. Format your responses with markdown for readability
`;

  return prompt;
}
