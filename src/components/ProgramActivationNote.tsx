import { Info } from 'lucide-react';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';

interface ProgramActivationNoteProps {
  tokenAddress: string;
  tokenStandard?: 'erc20' | 'b20';
}

export function ProgramActivationNote({
  tokenAddress,
  tokenStandard = 'erc20',
}: ProgramActivationNoteProps) {
  const { isPaused } = useCheckProgramStatus(
    tokenAddress as `0x${string}`,
    tokenStandard,
  );

  // B20 programs never need a two-step activation.
  if (tokenStandard === 'b20') return null;
  if (!isPaused) return null;

  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-900 dark:text-blue-100">
        Activation requires 2 transactions: unpause utility and enable minting
      </p>
    </div>
  );
}
