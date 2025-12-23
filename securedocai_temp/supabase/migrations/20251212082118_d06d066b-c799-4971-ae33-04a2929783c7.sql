-- Create ai_usage_logs table for tracking AI costs
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL, -- 'chat', 'document_generation', 'document_processing'
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage" ON public.ai_usage_logs
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all usage
CREATE POLICY "Admins can view all usage" ON public.ai_usage_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow inserts (for edge functions with service role)
CREATE POLICY "Allow insert usage logs" ON public.ai_usage_logs
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_ai_usage_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_session_id ON public.ai_usage_logs(session_id);
CREATE INDEX idx_ai_usage_created_at ON public.ai_usage_logs(created_at);

-- Create view for user totals (for admin panel)
CREATE VIEW public.user_usage_totals AS
SELECT 
  user_id,
  SUM(total_tokens)::bigint as lifetime_tokens,
  SUM(estimated_cost)::decimal(10,4) as lifetime_cost,
  COUNT(*)::bigint as total_operations
FROM public.ai_usage_logs
GROUP BY user_id;