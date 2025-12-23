import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { extractPdfText, isPdfFile, PDFExtractionProgress } from '@/lib/pdfParser';

export type SourceStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface Source {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: SourceStatus;
  error_message: string | null;
  uploaded_by: string;
  department_id: string | null;
  content_preview: string | null;
  page_count: number | null;
  processing_progress: number | null;
  processing_info: string | null;
  processing_started_at: string | null;
  created_at: string;
  updated_at: string;
  uploader?: {
    full_name: string | null;
    email: string;
  };
}

export function useSources() {
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    if (!user) return;

    try {
      // Silently cleanup stuck documents on each fetch
      supabase.functions.invoke('cleanup-stuck-documents').catch(err => {
        console.warn('Cleanup stuck documents check failed:', err);
      });

      const { data, error } = await supabase
        .from('sources')
        .select(`
          *,
          uploader:profiles!uploaded_by(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSources(data as Source[]);
    } catch (error) {
      console.error('Error fetching sources:', error);
      toast.error('Failed to load sources');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const uploadFiles = async (files: FileList) => {
    if (!user) {
      toast.error('You must be logged in to upload files');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setExtractionStatus(null);

    const totalFiles = files.length;
    let uploadedCount = 0;

    for (const file of Array.from(files)) {
      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const validTypes = ['pdf', 'docx', 'doc', 'txt'];
        
        if (!validTypes.includes(fileExt)) {
          toast.error(`Invalid file type: ${file.name}. Allowed: PDF, DOCX, DOC, TXT`);
          continue;
        }

        if (file.size > 50 * 1024 * 1024) { // Increased to 50MB since client-side handles it
          toast.error(`File too large: ${file.name}. Maximum size is 50MB`);
          continue;
        }

        let fileToUpload: File = file;
        let extractedText: string | null = null;
        let pageCount: number | null = null;

        // Client-side PDF extraction for PDFs
        if (isPdfFile(file)) {
          setExtractionStatus(`Extracting text from ${file.name}...`);
          
          const result = await extractPdfText(file, (progress: PDFExtractionProgress) => {
            setExtractionStatus(`Extracting page ${progress.currentPage} of ${progress.totalPages}...`);
          });

          if (result.success && result.text) {
            extractedText = result.text;
            pageCount = result.pageCount;
            setExtractionStatus(`Extracted ${pageCount} pages, uploading...`);
          } else {
            console.warn('PDF extraction failed, will use server-side fallback:', result.error);
          }
        }

        // Upload original file to storage
        const filePath = `${user.id}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, fileToUpload);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Create source record
        const { data: sourceData, error: sourceError } = await supabase
          .from('sources')
          .insert({
            name: file.name,
            file_path: filePath,
            file_type: fileExt,
            file_size: file.size,
            uploaded_by: user.id,
            status: 'pending',
            page_count: pageCount,
          })
          .select()
          .single();

        if (sourceError) {
          console.error('Source creation error:', sourceError);
          toast.error(`Failed to create record for ${file.name}`);
          continue;
        }

        // Trigger processing with pre-extracted text if available
        // Handle errors properly to mark source as failed
        supabase.functions.invoke('process-document', {
          body: { 
            sourceId: sourceData.id,
            preExtractedText: extractedText
          },
        }).then(response => {
          if (response.error) {
            console.error('Processing function error:', response.error);
            // Mark as error immediately if function invocation fails
            supabase.from('sources').update({
              status: 'error',
              error_message: `Processing failed to start: ${response.error.message || 'Unknown error'}`
            }).eq('id', sourceData.id);
          }
        }).catch(err => {
          console.error('Processing trigger error:', err);
          // Mark as error immediately if function invocation fails
          supabase.from('sources').update({
            status: 'error',
            error_message: 'Processing failed to start. Please try again.'
          }).eq('id', sourceData.id);
        });

        uploadedCount++;
        setUploadProgress((uploadedCount / totalFiles) * 100);
        
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Error uploading ${file.name}`);
      }
    }

    if (uploadedCount > 0) {
      toast.success(`Uploaded ${uploadedCount} file${uploadedCount > 1 ? 's' : ''}`);
      await fetchSources();
    }

    setIsUploading(false);
    setUploadProgress(0);
    setExtractionStatus(null);
  };

  const deleteSource = async (sourceId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('sources')
        .delete()
        .eq('id', sourceId);

      if (dbError) throw dbError;

      setSources(prev => prev.filter(s => s.id !== sourceId));
      toast.success('Source deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete source');
    }
  };

  const getDownloadUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting download URL:', error);
      toast.error('Failed to get download link');
      return null;
    }
  };

  const reprocessSource = async (sourceId: string) => {
    try {
      // Reset status to pending
      await supabase
        .from('sources')
        .update({ 
          status: 'pending', 
          error_message: null,
          processing_progress: 0,
          processing_info: null 
        })
        .eq('id', sourceId);

      // Trigger reprocessing
      await supabase.functions.invoke('process-document', {
        body: { sourceId },
      });

      toast.success('Reprocessing started');
    } catch (error) {
      console.error('Reprocess error:', error);
      toast.error('Failed to start reprocessing');
    }
  };

  // Set up realtime subscription for status updates
  useEffect(() => {
    if (!user) return;

    fetchSources();

    const channel = supabase
      .channel('sources-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sources',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setSources(prev => 
              prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
            );
          } else if (payload.eventType === 'INSERT') {
            fetchSources();
          } else if (payload.eventType === 'DELETE') {
            setSources(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Refetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSources();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchSources]);

  return {
    sources,
    isLoading,
    isUploading,
    uploadProgress,
    extractionStatus,
    uploadFiles,
    deleteSource,
    getDownloadUrl,
    reprocessSource,
    refetch: fetchSources,
  };
}
