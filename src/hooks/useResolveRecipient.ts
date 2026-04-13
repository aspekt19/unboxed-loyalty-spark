import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResolveResult {
  wallet_address: string;
  resolved_by: 'address' | 'email' | 'phone';
}

export function useResolveRecipient() {
  const [isResolving, setIsResolving] = useState(false);

  const resolveRecipient = useCallback(async (identifier: string): Promise<string | null> => {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    // If already a wallet address, return immediately
    if (/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) {
      return trimmed;
    }

    setIsResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-recipient', {
        body: { identifier: trimmed },
      });

      if (error) {
        toast.error('Failed to resolve recipient');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      const result = data as ResolveResult;
      const resolvedLabel = result.resolved_by === 'email' ? 'email' : 'phone number';
      toast.success(`Found wallet by ${resolvedLabel}`);
      return result.wallet_address;
    } catch (err) {
      console.error('Resolve recipient error:', err);
      toast.error('Failed to look up recipient');
      return null;
    } finally {
      setIsResolving(false);
    }
  }, []);

  return { resolveRecipient, isResolving };
}
