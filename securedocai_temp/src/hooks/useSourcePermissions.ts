import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type PermissionLevel = 'view' | 'chat' | 'share' | 'full_control';

export interface SourcePermission {
  id: string;
  source_id: string;
  user_id: string | null;
  department_id: string | null;
  is_company_wide: boolean;
  permission: PermissionLevel;
  granted_by: string;
  created_at: string;
  user?: { full_name: string | null; email: string };
  department?: { name: string };
}

export function useSourcePermissions(sourceId?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<SourcePermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!sourceId || !user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('source_permissions')
        .select(`
          *,
          user:profiles!user_id(full_name, email),
          department:departments!department_id(name)
        `)
        .eq('source_id', sourceId);

      if (error) throw error;
      setPermissions((data || []) as SourcePermission[]);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sourceId, user]);

  const shareWithUser = async (
    targetSourceId: string,
    userId: string,
    permission: PermissionLevel
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('source_permissions')
        .upsert({
          source_id: targetSourceId,
          user_id: userId,
          permission,
          granted_by: user.id,
        }, {
          onConflict: 'source_id,user_id',
        });

      if (error) throw error;
      toast.success('Permission granted');
      await fetchPermissions();
    } catch (error) {
      console.error('Error sharing with user:', error);
      toast.error('Failed to share with user');
    }
  };

  const shareWithDepartment = async (
    targetSourceId: string,
    departmentId: string,
    permission: PermissionLevel
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('source_permissions')
        .upsert({
          source_id: targetSourceId,
          department_id: departmentId,
          permission,
          granted_by: user.id,
        }, {
          onConflict: 'source_id,department_id',
        });

      if (error) throw error;
      toast.success('Shared with department');
      await fetchPermissions();
    } catch (error) {
      console.error('Error sharing with department:', error);
      toast.error('Failed to share with department');
    }
  };

  const shareWithCompany = async (
    targetSourceId: string,
    permission: PermissionLevel
  ) => {
    if (!user) return;

    try {
      // Remove existing company-wide permission first
      await supabase
        .from('source_permissions')
        .delete()
        .eq('source_id', targetSourceId)
        .eq('is_company_wide', true);

      const { error } = await supabase
        .from('source_permissions')
        .insert({
          source_id: targetSourceId,
          is_company_wide: true,
          permission,
          granted_by: user.id,
        });

      if (error) throw error;
      toast.success('Shared with company');
      await fetchPermissions();
    } catch (error) {
      console.error('Error sharing with company:', error);
      toast.error('Failed to share with company');
    }
  };

  const removePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from('source_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;
      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      toast.success('Permission removed');
    } catch (error) {
      console.error('Error removing permission:', error);
      toast.error('Failed to remove permission');
    }
  };

  return {
    permissions,
    isLoading,
    fetchPermissions,
    shareWithUser,
    shareWithDepartment,
    shareWithCompany,
    removePermission,
  };
}