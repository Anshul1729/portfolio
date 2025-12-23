-- Create source status enum
CREATE TYPE public.source_status AS ENUM ('pending', 'processing', 'ready', 'error');

-- Create sources table
CREATE TABLE public.sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status public.source_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  content_preview TEXT,
  page_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create source_chunks table for RAG/search
CREATE TABLE public.source_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster chunk lookups
CREATE INDEX idx_source_chunks_source_id ON public.source_chunks(source_id);
CREATE INDEX idx_sources_uploaded_by ON public.sources(uploaded_by);
CREATE INDEX idx_sources_department_id ON public.sources(department_id);
CREATE INDEX idx_sources_status ON public.sources(status);

-- Enable RLS
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sources
CREATE POLICY "Users can view sources in their department or public sources"
ON public.sources FOR SELECT
USING (
  department_id IS NULL 
  OR department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid())
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert their own sources"
ON public.sources FOR INSERT
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own sources"
ON public.sources FOR UPDATE
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own sources"
ON public.sources FOR DELETE
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS Policies for source_chunks (inherit from sources)
CREATE POLICY "Users can view chunks of accessible sources"
ON public.source_chunks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sources s
    WHERE s.id = source_id
    AND (
      s.department_id IS NULL
      OR s.department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid())
      OR has_role(auth.uid(), 'admin')
    )
  )
);

CREATE POLICY "System can manage chunks"
ON public.source_chunks FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_sources_updated_at
BEFORE UPDATE ON public.sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain']
);

-- Storage RLS policies
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view documents they have access to"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
  )
);