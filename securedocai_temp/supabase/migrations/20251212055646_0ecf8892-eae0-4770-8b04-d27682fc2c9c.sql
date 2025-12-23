-- =====================================================
-- PHASE 2B.3: Processing enhancements
-- =====================================================

-- Add processing progress columns to sources
ALTER TABLE public.sources 
ADD COLUMN IF NOT EXISTS processing_progress integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_info text;

-- =====================================================
-- PHASE 1B: Access Control System (Sharing Permissions)
-- =====================================================

-- Create permission level enum
CREATE TYPE permission_level AS ENUM ('view', 'chat', 'share', 'full_control');

-- Source permissions table for Google Drive-style sharing
CREATE TABLE public.source_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  is_company_wide BOOLEAN DEFAULT false,
  permission permission_level NOT NULL DEFAULT 'view',
  granted_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT permission_target_check CHECK (
    (user_id IS NOT NULL AND department_id IS NULL AND is_company_wide = false) OR
    (user_id IS NULL AND department_id IS NOT NULL AND is_company_wide = false) OR
    (user_id IS NULL AND department_id IS NULL AND is_company_wide = true)
  ),
  CONSTRAINT unique_user_permission UNIQUE (source_id, user_id),
  CONSTRAINT unique_dept_permission UNIQUE (source_id, department_id)
);

-- Enable RLS on source_permissions
ALTER TABLE public.source_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for source_permissions
CREATE POLICY "Users can view permissions for sources they own or have access to" 
ON public.source_permissions FOR SELECT 
USING (
  -- Owner of source
  source_id IN (SELECT id FROM public.sources WHERE uploaded_by = auth.uid())
  OR
  -- User has permission
  user_id = auth.uid()
  OR
  -- User is in the department
  department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid())
  OR
  -- Company wide permission
  is_company_wide = true
  OR
  -- Admins can see all
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Source owners can manage permissions" 
ON public.source_permissions FOR INSERT 
WITH CHECK (
  source_id IN (SELECT id FROM public.sources WHERE uploaded_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Source owners can update permissions" 
ON public.source_permissions FOR UPDATE 
USING (
  source_id IN (SELECT id FROM public.sources WHERE uploaded_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Source owners can delete permissions" 
ON public.source_permissions FOR DELETE 
USING (
  source_id IN (SELECT id FROM public.sources WHERE uploaded_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- =====================================================
-- PHASE 3A: Chat Foundation
-- =====================================================

-- Chats table
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  selected_source_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources_used JSONB DEFAULT '[]',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on chat tables
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chats
CREATE POLICY "Users can view their own chats" 
ON public.chats FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create chats" 
ON public.chats FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chats" 
ON public.chats FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own chats" 
ON public.chats FOR DELETE 
USING (user_id = auth.uid());

-- RLS policies for chat_messages
CREATE POLICY "Users can view messages in their chats" 
ON public.chat_messages FOR SELECT 
USING (chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert messages in their chats" 
ON public.chat_messages FOR INSERT 
WITH CHECK (chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()));

CREATE POLICY "Users can update messages in their chats" 
ON public.chat_messages FOR UPDATE 
USING (chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete messages in their chats" 
ON public.chat_messages FOR DELETE 
USING (chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()));

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Trigger for updating chat updated_at
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- PHASE 4: Studio - Generated Documents
-- =====================================================

-- Generated documents table
CREATE TABLE public.generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('report', 'presentation', 'summary', 'faq')),
  content TEXT NOT NULL,
  source_ids UUID[] DEFAULT '{}',
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on generated_documents
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for generated_documents
CREATE POLICY "Users can view their own generated documents" 
ON public.generated_documents FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create generated documents" 
ON public.generated_documents FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own generated documents" 
ON public.generated_documents FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own generated documents" 
ON public.generated_documents FOR DELETE 
USING (user_id = auth.uid());

-- Trigger for updating generated_documents updated_at
CREATE TRIGGER update_generated_documents_updated_at
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- Helper function to check source access
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_source_access(_user_id uuid, _source_id uuid, _min_permission permission_level DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Owner always has access
    SELECT 1 FROM public.sources WHERE id = _source_id AND uploaded_by = _user_id
  ) OR EXISTS (
    -- User has direct permission
    SELECT 1 FROM public.source_permissions sp
    WHERE sp.source_id = _source_id 
      AND sp.user_id = _user_id
      AND CASE _min_permission
        WHEN 'view' THEN true
        WHEN 'chat' THEN sp.permission IN ('chat', 'share', 'full_control')
        WHEN 'share' THEN sp.permission IN ('share', 'full_control')
        WHEN 'full_control' THEN sp.permission = 'full_control'
      END
  ) OR EXISTS (
    -- Department permission
    SELECT 1 FROM public.source_permissions sp
    JOIN public.profiles p ON p.department_id = sp.department_id
    WHERE sp.source_id = _source_id 
      AND p.id = _user_id
      AND CASE _min_permission
        WHEN 'view' THEN true
        WHEN 'chat' THEN sp.permission IN ('chat', 'share', 'full_control')
        WHEN 'share' THEN sp.permission IN ('share', 'full_control')
        WHEN 'full_control' THEN sp.permission = 'full_control'
      END
  ) OR EXISTS (
    -- Company-wide permission
    SELECT 1 FROM public.source_permissions sp
    WHERE sp.source_id = _source_id 
      AND sp.is_company_wide = true
      AND CASE _min_permission
        WHEN 'view' THEN true
        WHEN 'chat' THEN sp.permission IN ('chat', 'share', 'full_control')
        WHEN 'share' THEN sp.permission IN ('share', 'full_control')
        WHEN 'full_control' THEN sp.permission = 'full_control'
      END
  ) OR has_role(_user_id, 'admin'::app_role)
$$;