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
  isDeleting: boolean;
  onPause: () => void;
  onActivate: () => void;
  onDelete: () => void;
}

export function ProgramControlButtons({ 
  tokenAddress, 
  isToggling,
  isDeleting,
  onPause,
  onActivate,
  onDelete
}: ProgramControlButtonsProps) {
  const { isPaused, hasStatusErrors } = useCheckProgramStatus(tokenAddress as `0x${string}`);

  return (
    <div className="flex items-center gap-0">
      <TooltipProvider>
        {/* Pause Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onPause();
                }}
                disabled={isToggling || isPaused || hasStatusErrors}
              >
                {isToggling && !isPaused ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Pause className="h-3 w-3 text-amber-600" />
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {hasStatusErrors ? 'Status check failed - old contract version?' : 'Pause Program'}
          </TooltipContent>
        </Tooltip>

        {/* Activate Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate();
                }}
                disabled={isToggling || !isPaused || hasStatusErrors}
              >
                {isToggling && isPaused ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 text-green-600" />
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {hasStatusErrors ? 'Status check failed - old contract version?' : 'Activate Program'}
          </TooltipContent>
        </Tooltip>

        {/* Delete Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3 text-destructive" />
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Delete Program</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
