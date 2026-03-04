import { useReadContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { type TokenAddress, TOKEN_STATUS_ABI, txLog } from './types/transaction';

const HOOK_NAME = 'CheckProgramStatus';

/** Polling interval for contract status checks (ms) */
const STATUS_POLL_INTERVAL = 5000;

export interface ProgramStatus {
  isMintingActive: boolean;
  isUtilityActive: boolean;
  isPaused: boolean;
  hasStatusErrors: boolean;
}

export function useCheckProgramStatus(tokenAddress: TokenAddress | undefined): ProgramStatus {
  const queryClient = useQueryClient();

  const queryOptions = {
    enabled: !!tokenAddress,
    refetchInterval: STATUS_POLL_INTERVAL,
    refetchOnMount: true as const,
    refetchOnWindowFocus: true as const,
    retry: 1,
  };

  const { data: isMintingActive, isError: mintingError } = useReadContract({
    address: tokenAddress,
    abi: TOKEN_STATUS_ABI.isMintingActive,
    functionName: 'isMintingActive',
    query: queryOptions,
  });

  const { data: isUtilityActive, isError: utilityError } = useReadContract({
    address: tokenAddress,
    abi: TOKEN_STATUS_ABI.isUtilityActive,
    functionName: 'isUtilityActive',
    query: queryOptions,
  });

  // Invalidate cache on program update events
  useEffect(() => {
    const handleProgramUpdate = () => {
      if (tokenAddress) {
        txLog(HOOK_NAME, 'debug', 'Invalidating status cache', { tokenAddress });
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const state = query.state;
            return state.data !== undefined && 
                   JSON.stringify(state.data).includes(tokenAddress);
          }
        });
      }
    };

    window.addEventListener('loyaltyProgramsUpdated', handleProgramUpdate);
    return () => window.removeEventListener('loyaltyProgramsUpdated', handleProgramUpdate);
  }, [tokenAddress, queryClient]);

  useEffect(() => {
    if (tokenAddress) {
      txLog(HOOK_NAME, 'debug', 'Status update', {
        tokenAddress,
        isMintingActive,
        isUtilityActive,
        isPaused: !(isMintingActive && isUtilityActive),
      });
    }
  }, [tokenAddress, isMintingActive, isUtilityActive]);

  return {
    isMintingActive: isMintingActive ?? false,
    isUtilityActive: isUtilityActive ?? false,
    isPaused: !(isMintingActive && isUtilityActive),
    hasStatusErrors: mintingError || utilityError,
  };
}
