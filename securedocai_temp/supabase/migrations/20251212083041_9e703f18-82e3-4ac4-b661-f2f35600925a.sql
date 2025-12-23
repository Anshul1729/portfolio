-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view sources in their department or public sources" ON public.sources;

-- Create a new secure policy that respects the permission system
-- Sources are visible to:
-- 1. The owner (uploaded_by)
-- 2. Users with explicit permission via source_permissions
-- 3. Users in same department if source has a department
-- 4. Company-wide shared sources
-- 5. Admins
CREATE POLICY "Users can view accessible sources" ON public.sources
FOR SELECT USING (
  -- Owner can always see their own sources
  uploaded_by = auth.uid()
  -- Or user has explicit permission (via has_source_access function)
  OR has_source_access(auth.uid(), id, 'view'::permission_level)
  -- Or admin
  OR has_role(auth.uid(), 'admin'::app_role)
);