import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';
import {
  encodeCreateB20Asset,
  extractB20TokenAddress,
  B20_FACTORY_ADDRESS,
} from '@/config/b20';
import { txLog } from './types/transaction';

const HOOK_NAME = 'DeployB20';

/**
 * Deploy a new B20 (Base native ERC-20 superset) loyalty token in a single tx.
 * Grants MINT_ROLE to the merchant atomically via `initCalls`, so no separate
 * activation step is needed (unlike the legacy ERC-20 factory).
 */
export function useDeployB20Token() {
  const { address } = useAccount();
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string | null>(
    null,
  );

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess && receipt && address && !deployedTokenAddress) {
      const token = extractB20TokenAddress(
        receipt.logs as unknown as { address: string; topics: string[] }[],
      );
      if (token) {
        txLog(HOOK_NAME, 'info', 'B20 token created', { token });
        setDeployedTokenAddress(token);
        toast.success('Loyalty program deployed on Base (B20)!');
      } else {
        txLog(HOOK_NAME, 'error', 'B20Created event not found in receipt');
        toast.error('Deploy succeeded but token address could not be extracted');
      }
    }
  }, [isSuccess, receipt, address, deployedTokenAddress]);

  const deployToken = useCallback(
    (name: string, symbol: string) => {
      if (!address) {
        toast.error('Please connect your wallet first');
        return;
      }
      setDeployedTokenAddress(null);
      try {
        const { data } = encodeCreateB20Asset(address, name, symbol, 18);
        txLog(HOOK_NAME, 'info', 'Deploying B20 token', { name, symbol });
        sendTransaction({
          to: B20_FACTORY_ADDRESS,
          data,
        });
      } catch (err) {
        txLog(HOOK_NAME, 'error', 'Deploy failed', err);
        toast.error('Failed to encode B20 deploy transaction');
      }
    },
    [address, sendTransaction],
  );

  return {
    deployToken,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
    deployedTokenAddress,
  };
}
