import { useReadContract, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { formatUnits } from 'viem';

export function useTokenBalance() {
  const { address } = useAccount();

  const { data: balance, isLoading, refetch } = useReadContract({
    address: CONTRACTS.LOYAL_SPARK_ERC20.address,
    abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const formattedBalance = balance ? formatUnits(balance as bigint, 18) : '0';

  return {
    balance: formattedBalance,
    rawBalance: balance as bigint | undefined,
    isLoading,
    refetch,
  };
}
