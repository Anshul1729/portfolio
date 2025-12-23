import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UsageStats {
  sessionCost: number;
  lifetimeCost: number;
  sessionTokens: number;
  lifetimeTokens: number;
  isLoading: boolean;
}

// Generate or retrieve session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('ai_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('ai_session_id', sessionId);
  }
  return sessionId;
};

export const getAISessionId = getSessionId;

export function useCostTracking(): UsageStats & { refetch: () => Promise<void> } {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats>({
    sessionCost: 0,
    lifetimeCost: 0,
    sessionTokens: 0,
    lifetimeTokens: 0,
    isLoading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const sessionId = getSessionId();

      // Fetch session stats
      const { data: sessionData } = await supabase
        .from('ai_usage_logs')
        .select('total_tokens, estimated_cost')
        .eq('user_id', user.id)
        .eq('session_id', sessionId);

      // Fetch lifetime stats
      const { data: lifetimeData } = await supabase
        .from('ai_usage_logs')
        .select('total_tokens, estimated_cost')
        .eq('user_id', user.id);

      const sessionCost = sessionData?.reduce((sum, row) => sum + Number(row.estimated_cost), 0) || 0;
      const sessionTokens = sessionData?.reduce((sum, row) => sum + row.total_tokens, 0) || 0;
      const lifetimeCost = lifetimeData?.reduce((sum, row) => sum + Number(row.estimated_cost), 0) || 0;
      const lifetimeTokens = lifetimeData?.reduce((sum, row) => sum + row.total_tokens, 0) || 0;

      setStats({
        sessionCost,
        lifetimeCost,
        sessionTokens,
        lifetimeTokens,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch cost stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Subscribe to realtime updates for new usage logs
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('ai_usage_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_usage_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchStats]);

  return { ...stats, refetch: fetchStats };
}

// Hook for admin to fetch all users' usage
export function useAllUsersUsage() {
  const [usageByUser, setUsageByUser] = useState<Record<string, { cost: number; tokens: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllUsage = async () => {
      try {
        const { data } = await supabase
          .from('ai_usage_logs')
          .select('user_id, total_tokens, estimated_cost');

        if (data) {
          const aggregated: Record<string, { cost: number; tokens: number }> = {};
          data.forEach(row => {
            if (!aggregated[row.user_id]) {
              aggregated[row.user_id] = { cost: 0, tokens: 0 };
            }
            aggregated[row.user_id].cost += Number(row.estimated_cost);
            aggregated[row.user_id].tokens += row.total_tokens;
          });
          setUsageByUser(aggregated);
        }
      } catch (error) {
        console.error('Failed to fetch all users usage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllUsage();
  }, []);

  return { usageByUser, isLoading };
}
