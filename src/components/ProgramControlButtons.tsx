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
  const { isPaused } = useCheckProgramStatus(tokenAddress as `0x${string}`);

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        {/* Pause Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onPause();
              }}
              disabled={isToggling || isPaused}
            >
              {isToggling && !isPaused ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4 text-amber-600" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pause Program</TooltipContent>
        </Tooltip>

        {/* Activate Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
              disabled={isToggling || !isPaused}
            >
              {isToggling && isPaused ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 text-green-600" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Activate Program</TooltipContent>
        </Tooltip>

        {/* Delete Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Program</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
