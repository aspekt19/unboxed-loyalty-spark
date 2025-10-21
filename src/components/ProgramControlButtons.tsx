import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause, Trash2 } from 'lucide-react';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProgramControlButtonsProps {
  tokenAddress: string;
  isToggling: boolean;
  onToggle: (isPaused: boolean) => void;
}

export function ProgramControlButtons({ 
  tokenAddress, 
  isToggling, 
  onToggle
}: ProgramControlButtonsProps) {
  const { isPaused } = useCheckProgramStatus(tokenAddress as `0x${string}`);

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(isPaused);
              }}
              disabled={isToggling}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPaused ? (
                <Play className="h-4 w-4 text-green-600" />
              ) : (
                <Pause className="h-4 w-4 text-amber-600" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isPaused ? 'Активировать программу' : 'Деактивировать программу'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
