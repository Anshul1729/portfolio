import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getAISessionId } from '@/hooks/useCostTracking';
import { toast } from 'sonner';

export type DocumentType = 'report' | 'presentation' | 'summary' | 'faq';

export interface GeneratedDocument {
  id: string;
  title: string;
  document_type: DocumentType;
  content: string;
  source_ids: string[];
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export function useGeneratedDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments((data || []) as GeneratedDocument[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const generateDocument = async (
    documentType: DocumentType,
    sourceIds: string[],
    title?: string,
    additionalInstructions?: string
  ): Promise<GeneratedDocument | null> => {
    if (!user || sourceIds.length === 0) {
      toast.error('Please select at least one source');
      return null;
    }

    setIsGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            documentType,
            sourceIds,
            title,
            additionalInstructions,
            sessionId: getAISessionId(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();
      const newDoc = data.document as GeneratedDocument;
      
      setDocuments(prev => [newDoc, ...prev]);
      toast.success('Document generated successfully');
      return newDoc;
    } catch (error) {
      console.error('Error generating document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate document');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('generated_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      setDocuments(prev => prev.filter(d => d.id !== documentId));
      toast.success('Document deleted');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const updateDocument = async (documentId: string, updates: Partial<Pick<GeneratedDocument, 'title' | 'content'>>) => {
    try {
      const { error } = await supabase
        .from('generated_documents')
        .update(updates)
        .eq('id', documentId);

      if (error) throw error;

      setDocuments(prev => prev.map(d =>
        d.id === documentId ? { ...d, ...updates } : d
      ));
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document');
    }
  };

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user, fetchDocuments]);

  return {
    documents,
    isLoading,
    isGenerating,
    generateDocument,
    deleteDocument,
    updateDocument,
    refetch: fetchDocuments,
  };
}