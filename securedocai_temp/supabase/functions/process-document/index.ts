import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Token-based chunking config (NoobBook pattern)
const CHUNK_SIZE_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 100;
const CHARS_PER_TOKEN = 4;

// Page processing config (NoobBook pattern)
const PAGES_PER_BATCH = 5; // Process 5 pages per AI call for large files
const ESTIMATED_CHARS_PER_PAGE = 3000;

// Cost calculation for Gemini 2.5 Flash
const PRICING = {
  input: 0.075 / 1_000_000,  // $0.075 per 1M input tokens
  output: 0.30 / 1_000_000,  // $0.30 per 1M output tokens
};

// Usage accumulator for tracking AI costs during processing
interface UsageAccumulator {
  promptTokens: number;
  completionTokens: number;
  aiCalls: number;
}

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceId, preExtractedText } = await req.json();

    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: "sourceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI processing not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get source details
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      console.error("Source not found:", sourceError);
      return new Response(
        JSON.stringify({ error: "Source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing immediately with timestamp
    await supabase
      .from("sources")
      .update({ 
        status: "processing", 
        error_message: null,
        processing_started_at: new Date().toISOString(),
        processing_progress: 0,
        processing_info: "Starting processing..."
      })
      .eq("id", sourceId);

    console.log(`Starting processing: ${source.name} (${source.file_type}, ${(source.file_size / 1024 / 1024).toFixed(2)}MB)`);
    
    if (preExtractedText) {
      console.log(`Using pre-extracted text (${preExtractedText.length} chars) - skipping AI extraction`);
    }

    // Use EdgeRuntime.waitUntil for background processing (NoobBook pattern)
    // This allows the response to return immediately while processing continues
    EdgeRuntime.waitUntil(
      processDocumentInBackground(supabase, source, lovableApiKey, preExtractedText)
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Document processing started",
        sourceId: sourceId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Request error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Process document in background (NoobBook pattern)
 * This function runs after the HTTP response is sent
 */
// deno-lint-ignore no-explicit-any
async function processDocumentInBackground(supabase: any, source: any, apiKey: string, preExtractedText?: string) {
  const sourceId = source.id;
  const userId = source.uploaded_by;
  
  // Usage accumulator for tracking AI costs
  const usage: UsageAccumulator = { promptTokens: 0, completionTokens: 0, aiCalls: 0 };
  
  try {
    console.log(`Background processing started for: ${source.name}`);
    
    let textContent = "";
    let pageCount = source.page_count || 1;

    // If pre-extracted text is provided (from client-side PDF.js), use it directly
    if (preExtractedText && preExtractedText.length > 0) {
      console.log(`Using pre-extracted text: ${preExtractedText.length} characters`);
      textContent = preExtractedText;
      
      // Count pages from page markers
      const pageMatches = preExtractedText.match(/=== PAGE \d+ of (\d+) ===/g);
      if (pageMatches && pageMatches.length > 0) {
        const lastMatch = pageMatches[pageMatches.length - 1];
        const totalPages = lastMatch.match(/of (\d+)/);
        if (totalPages) {
          pageCount = parseInt(totalPages[1], 10);
        }
      }
      
      await supabase
        .from("sources")
        .update({ 
          processing_progress: 50, 
          processing_info: "Text extracted, creating chunks..." 
        })
        .eq("id", sourceId);
        
    } else {
      // No pre-extracted text, need to download and process
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(source.file_path);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      if (source.file_type === "txt") {
        // Direct text extraction for TXT files (NoobBook pattern - no AI needed)
        textContent = await fileData.text();
        pageCount = Math.ceil(textContent.length / ESTIMATED_CHARS_PER_PAGE) || 1;
        console.log(`TXT: Extracted ${textContent.length} characters directly`);
        
      } else if (source.file_type === "pdf") {
        // PDF processing with page-by-page extraction (NoobBook pattern)
        // For large PDFs (>2MB), server-side AI extraction is too slow and will timeout
        // These should use client-side extraction instead
        const fileSizeMB = source.file_size / (1024 * 1024);
        if (fileSizeMB > 2) {
          throw new Error(
            `PDF too large for server-side processing (${fileSizeMB.toFixed(1)}MB). ` +
            `Please try re-uploading - client-side extraction should handle this automatically. ` +
            `If the issue persists, try a smaller file or contact support.`
          );
        }
        
        const result = await extractPdfContent(fileData, source.file_size, apiKey, supabase, sourceId, usage);
        textContent = result.text;
        pageCount = result.pageCount;
        
      } else if (source.file_type === "docx" || source.file_type === "doc") {
        // DOCX processing with structure preservation (NoobBook pattern)
        const result = await extractDocxContent(fileData, source.file_size, apiKey, usage);
        textContent = result.text;
        pageCount = result.pageCount;
      }
    }

    // Create content preview
    const contentPreview = textContent.substring(0, 500).trim() || `[${source.file_type.toUpperCase()} document]`;

    // Token-based chunking with sentence boundaries (NoobBook pattern)
    const chunks = textContent ? splitIntoSmartChunks(textContent) : [];

    // Delete existing chunks if re-processing
    await supabase
      .from("source_chunks")
      .delete()
      .eq("source_id", sourceId);

    // Insert chunks in batches
    if (chunks.length > 0) {
      const chunkInserts = chunks.map((content, index) => ({
        source_id: sourceId,
        chunk_index: index,
        content,
      }));

      for (let i = 0; i < chunkInserts.length; i += 50) {
        const batch = chunkInserts.slice(i, i + 50);
        const { error: chunksError } = await supabase
          .from("source_chunks")
          .insert(batch);

        if (chunksError) {
          console.error(`Failed to insert chunks batch ${i / 50}:`, chunksError);
        }
      }
      console.log(`Inserted ${chunks.length} chunks`);
    }

    // Update source with success
    await supabase
      .from("sources")
      .update({
        status: "ready",
        content_preview: contentPreview,
        page_count: pageCount,
        error_message: null,
      })
      .eq("id", sourceId);

    console.log(`SUCCESS: ${source.name} - ${pageCount} pages, ${chunks.length} chunks`);

    // Log AI usage if any AI calls were made
    if (usage.aiCalls > 0) {
      const totalTokens = usage.promptTokens + usage.completionTokens;
      const estimatedCost = (usage.promptTokens * PRICING.input) + (usage.completionTokens * PRICING.output);
      
      await supabase
        .from("ai_usage_logs")
        .insert({
          user_id: userId,
          operation_type: "document_processing",
          model: "google/gemini-2.5-flash",
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: totalTokens,
          estimated_cost: estimatedCost,
          session_id: null,
          metadata: { source_id: sourceId, file_type: source.file_type, ai_calls: usage.aiCalls },
        });

      console.log(`Document processing usage logged: ${totalTokens} tokens, ${usage.aiCalls} AI calls, $${estimatedCost.toFixed(6)}`);
    }

  } catch (error) {
    console.error("Background processing error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown processing error";
    
    await supabase
      .from("sources")
      .update({ 
        status: "error", 
        error_message: errorMessage
      })
      .eq("id", sourceId);
  }
}

/**
 * Extract PDF content using page-by-page processing (NoobBook pattern)
 * For small PDFs: Process all at once
 * For large PDFs: Process in batches with page markers
 */
async function extractPdfContent(
  fileData: Blob,
  fileSize: number,
  apiKey: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  sourceId: string,
  usage: UsageAccumulator
): Promise<{ text: string; pageCount: number }> {
  const fileSizeMB = fileSize / (1024 * 1024);
  const estimatedPages = Math.ceil(fileSize / 50000); // Rough estimate: 50KB per page
  
  console.log(`PDF Processing: ${fileSizeMB.toFixed(2)}MB, estimated ${estimatedPages} pages`);

  const base64Content = await blobToBase64(fileData);

  // For smaller PDFs (≤15 pages estimated), process in one call
  if (estimatedPages <= 15) {
    console.log(`Small PDF - processing all pages in single call`);
    return await extractPdfSingleCall(base64Content, apiKey, usage);
  }

  // For larger PDFs, process in batches (NoobBook pattern)
  console.log(`Large PDF - processing in batches of ${PAGES_PER_BATCH} pages`);
  return await extractPdfInBatches(base64Content, estimatedPages, apiKey, supabase, sourceId, usage);
}

/**
 * Extract PDF in a single AI call (for smaller files)
 */
async function extractPdfSingleCall(
  base64Content: string,
  apiKey: string,
  usage: UsageAccumulator
): Promise<{ text: string; pageCount: number }> {
  const systemPrompt = `You are an expert document text extractor. Extract ALL text from this PDF with high fidelity.

CRITICAL INSTRUCTIONS:
1. Extract EVERY piece of visible text - headers, footers, captions, annotations
2. Mark each page transition with: === PDF PAGE X of Y ===
3. Preserve document structure using markdown:
   - # for main headings, ## for subheadings
   - Bullet points and numbered lists
   - Tables in markdown format
4. If text is unclear, mark as [unclear text]
5. Return ONLY the extracted text, no commentary`;

  const userContent = "Extract all text from this PDF. Mark each page with === PDF PAGE X of Y ===";

  const response = await fetchWithRetry(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userContent },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64Content}` }
              }
            ]
          }
        ],
      }),
    },
    3
  );

  if (!response.ok) {
    await handleAiError(response);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  
  // Track usage
  usage.aiCalls++;
  usage.promptTokens += Math.ceil((systemPrompt.length + userContent.length + base64Content.length * 0.1) / 4);
  usage.completionTokens += Math.ceil(text.length / 4);
  
  // Count pages from markers
  const pageMatches = text.match(/=== PDF PAGE \d+ of (\d+) ===/g);
  const pageCount = pageMatches 
    ? Math.max(...pageMatches.map((m: string) => parseInt(m.match(/of (\d+)/)?.[1] || "1")))
    : Math.max(1, Math.ceil(text.length / ESTIMATED_CHARS_PER_PAGE));

  console.log(`Single call extracted: ${text.length} chars, ${pageCount} pages`);
  return { text, pageCount };
}

/**
 * Extract PDF in batches for large files (NoobBook pattern)
 * Processes page ranges and combines results
 */
async function extractPdfInBatches(
  base64Content: string,
  estimatedPages: number,
  apiKey: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  sourceId: string,
  usage: UsageAccumulator
): Promise<{ text: string; pageCount: number }> {
  const allText: string[] = [];
  const totalBatches = Math.ceil(estimatedPages / PAGES_PER_BATCH);
  let actualPageCount = estimatedPages;

  for (let batch = 0; batch < totalBatches; batch++) {
    const startPage = batch * PAGES_PER_BATCH + 1;
    const endPage = Math.min((batch + 1) * PAGES_PER_BATCH, estimatedPages);
    
    console.log(`Processing batch ${batch + 1}/${totalBatches}: pages ${startPage}-${endPage}`);

    // Update progress with heartbeat (updates updated_at for stuck detection)
    const progressPercent = Math.round((batch / totalBatches) * 80); // 0-80% for extraction
    await supabase
      .from("sources")
      .update({ 
        processing_progress: progressPercent,
        processing_info: `Processing pages ${startPage}-${endPage} of ~${estimatedPages}...`,
        updated_at: new Date().toISOString() // Heartbeat for stuck detection
      })
      .eq("id", sourceId);

    try {
      const batchText = await extractPdfPageRange(base64Content, startPage, endPage, estimatedPages, apiKey, usage);
      allText.push(batchText);
      
      // Update actual page count from first batch if available
      if (batch === 0) {
        const pageMatch = batchText.match(/=== PDF PAGE \d+ of (\d+) ===/);
        if (pageMatch) {
          actualPageCount = parseInt(pageMatch[1]);
        }
      }
    } catch (error) {
      console.error(`Batch ${batch + 1} failed:`, error);
      // Continue with other batches instead of failing completely
      allText.push(`[Error extracting pages ${startPage}-${endPage}]`);
    }

    // Small delay between batches to avoid rate limits
    if (batch < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const combinedText = allText.join("\n\n");
  console.log(`Batch processing complete: ${combinedText.length} chars, ${actualPageCount} pages`);
  
  return { text: combinedText, pageCount: actualPageCount };
}

/**
 * Extract a specific page range from PDF
 */
async function extractPdfPageRange(
  base64Content: string,
  startPage: number,
  endPage: number,
  totalPages: number,
  apiKey: string,
  usage: UsageAccumulator
): Promise<string> {
  const systemPrompt = `You are an expert document text extractor. Extract text from pages ${startPage} to ${endPage} of this PDF.

CRITICAL INSTRUCTIONS:
1. Focus on pages ${startPage} through ${endPage} only
2. Mark each page with: === PDF PAGE X of ${totalPages} ===
3. Extract ALL visible text with markdown formatting
4. Preserve structure: headings, lists, tables
5. Mark unclear text as [unclear text]
6. Return ONLY extracted text`;

  const userContent = `Extract text from pages ${startPage}-${endPage}. Mark each page with === PDF PAGE X of ${totalPages} ===`;

  const response = await fetchWithRetry(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userContent },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64Content}` }
              }
            ]
          }
        ],
      }),
    },
    3
  );

  if (!response.ok) {
    await handleAiError(response);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  
  // Track usage
  usage.aiCalls++;
  usage.promptTokens += Math.ceil((systemPrompt.length + userContent.length + base64Content.length * 0.1) / 4);
  usage.completionTokens += Math.ceil(text.length / 4);
  
  return text;
}

/**
 * Extract DOCX content with structure preservation (NoobBook pattern)
 */
async function extractDocxContent(
  fileData: Blob,
  fileSize: number,
  apiKey: string,
  usage: UsageAccumulator
): Promise<{ text: string; pageCount: number }> {
  const fileSizeMB = fileSize / (1024 * 1024);
  console.log(`DOCX Processing: ${fileSizeMB.toFixed(2)}MB`);

  const base64Content = await blobToBase64(fileData);

  // DOCX-specific extraction prompt (NoobBook pattern)
  const systemPrompt = `You are an expert document text extractor for Word documents.

CRITICAL INSTRUCTIONS:
1. Extract ALL text content from the DOCX file
2. Preserve document structure in markdown:
   - # for Heading 1, ## for Heading 2, etc.
   - Preserve bullet points and numbered lists exactly
   - Convert tables to markdown table format
   - Preserve bold (**text**) and italic (*text*) formatting
3. Keep paragraph breaks intact
4. For images, note: [Image: description if visible]
5. Extract headers, footers, and footnotes
6. Return ONLY the extracted text, no commentary`;

  const userContent = "Extract all text from this Word document. Preserve all formatting and structure in markdown.";

  const response = await fetchWithRetry(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userContent },
              {
                type: "image_url",
                image_url: { 
                  url: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Content}` 
                }
              }
            ]
          }
        ],
      }),
    },
    3
  );

  if (!response.ok) {
    await handleAiError(response);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  
  // Track usage
  usage.aiCalls++;
  usage.promptTokens += Math.ceil((systemPrompt.length + userContent.length + base64Content.length * 0.1) / 4);
  usage.completionTokens += Math.ceil(text.length / 4);
  
  const pageCount = Math.max(1, Math.ceil(text.length / ESTIMATED_CHARS_PER_PAGE));

  console.log(`DOCX extracted: ${text.length} chars, ~${pageCount} pages`);
  return { text, pageCount };
}

/**
 * Handle AI API errors with specific messages
 */
async function handleAiError(response: Response): Promise<never> {
  const errorText = await response.text();
  console.error("AI error:", response.status, errorText);

  if (response.status === 429) {
    throw new Error("AI rate limit exceeded. Please try again in a few minutes.");
  }
  if (response.status === 402) {
    throw new Error("AI credits exhausted. Please add funds to continue.");
  }
  throw new Error(`AI extraction failed (${response.status})`);
}

/**
 * Fetch with exponential backoff retry (NoobBook pattern)
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry on client errors (except rate limits)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      
      // Retry on server errors or rate limits
      if (response.status >= 500 || response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${waitTime}ms (status: ${response.status})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${waitTime}ms (error: ${lastError.message})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError || new Error("Max retries exceeded");
}

/**
 * Token-based chunking with sentence boundaries (NoobBook pattern)
 * Preserves page markers in chunks for citation support
 */
function splitIntoSmartChunks(text: string): string[] {
  const chunks: string[] = [];
  const targetChunkSize = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
  const overlapSize = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;
  
  // Split into sentences
  const sentences = splitIntoSentences(text);
  
  let currentChunk = "";
  let overlapBuffer = "";
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    // If adding this sentence would exceed chunk size
    if (currentChunk.length + trimmedSentence.length > targetChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = overlapBuffer + " " + trimmedSentence;
    } else {
      currentChunk = currentChunk ? currentChunk + " " + trimmedSentence : trimmedSentence;
    }
    
    // Update overlap buffer
    const combinedForOverlap = overlapBuffer + " " + trimmedSentence;
    overlapBuffer = combinedForOverlap.length > overlapSize 
      ? combinedForOverlap.slice(-overlapSize).trim()
      : combinedForOverlap.trim();
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50);
}

/**
 * Split text into sentences (handles abbreviations)
 */
function splitIntoSentences(text: string): string[] {
  const abbreviations = ['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'inc', 'ltd', 'co', 'corp', 'st', 'ave', 'blvd', 'e.g', 'i.e', 'fig', 'vol', 'no', 'pp'];
  
  let processedText = text;
  for (const abbr of abbreviations) {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
    processedText = processedText.replace(regex, `${abbr}<<DOT>>`);
  }
  
  // Also preserve page markers
  processedText = processedText.replace(/=== PDF PAGE/g, '<<PAGE_MARKER>>');
  
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*\n+/g;
  const sentences = processedText.split(sentenceRegex);
  
  return sentences.map(s => s.replace(/<<DOT>>/g, '.').replace(/<<PAGE_MARKER>>/g, '=== PDF PAGE'));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Handle shutdown gracefully
addEventListener('beforeunload', (ev: Event) => {
  const detail = (ev as CustomEvent).detail;
  console.log('Function shutdown:', detail?.reason || 'unknown');
});
