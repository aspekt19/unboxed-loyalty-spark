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

/**
 * B20 tokens are ALWAYS active — the pause/enableMinting concepts don't exist
 * on the B20 precompile (roles + MINT_ROLE handle everything). For legacy
 * ERC-20 programs we still poll the on-chain flags.
 */
export function useCheckProgramStatus(
  tokenAddress: TokenAddress | undefined,
  tokenStandard: 'erc20' | 'b20' = 'erc20',
): ProgramStatus {
  const queryClient = useQueryClient();
  const isB20 = tokenStandard === 'b20';

  const queryOptions = {
    // Skip on-chain reads for B20 — the calls would revert (functions don't exist).
    enabled: !!tokenAddress && !isB20,
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
            return (
              state.data !== undefined &&
              JSON.stringify(state.data).includes(tokenAddress)
            );
          },
        });
      }
    };

    window.addEventListener('loyaltyProgramsUpdated', handleProgramUpdate);
    return () =>
      window.removeEventListener('loyaltyProgramsUpdated', handleProgramUpdate);
  }, [tokenAddress, queryClient]);

  if (isB20) {
    // B20 has no pause/minting toggles — always report fully active.
    return {
      isMintingActive: true,
      isUtilityActive: true,
      isPaused: false,
      hasStatusErrors: false,
    };
  }

  return {
    isMintingActive: isMintingActive ?? false,
    isUtilityActive: isUtilityActive ?? false,
    isPaused: !(isMintingActive && isUtilityActive),
    hasStatusErrors: mintingError || utilityError,
  };
}
