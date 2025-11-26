import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePremiumPlans = () => {
  return useQuery({
    queryKey: ['premium-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_plans')
        .select('*')
        .eq('is_active', true)
        .order('duration_months', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};
