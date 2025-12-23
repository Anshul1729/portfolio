-- Drop the view and recreate with security_invoker = true
DROP VIEW IF EXISTS public.user_usage_totals;

CREATE VIEW public.user_usage_totals 
WITH (security_invoker = true) AS
SELECT 
  user_id,
  SUM(total_tokens)::bigint as lifetime_tokens,
  SUM(estimated_cost)::decimal(10,4) as lifetime_cost,
  COUNT(*)::bigint as total_operations
FROM public.ai_usage_logs
GROUP BY user_id;