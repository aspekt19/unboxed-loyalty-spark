import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addMonths, addDays, format } from 'date-fns';

interface ExtendProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  programName: string;
  currentExpirationDate: string;
  tokenAddress: string;
}

const EXTEND_OPTIONS = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
];

export function ExtendProgramDialog({
  open,
  onOpenChange,
  programId,
  programName,
  currentExpirationDate,
  tokenAddress,
}: ExtendProgramDialogProps) {
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [isExtending, setIsExtending] = useState(false);

  const currentDate = new Date(currentExpirationDate);
  const baseDate = currentDate > new Date() ? currentDate : new Date();
  const newDate = selectedMonths ? addMonths(baseDate, selectedMonths) : null;

  const handleExtend = async () => {
    if (!selectedMonths || !newDate) return;

    setIsExtending(true);
    try {
      const { error } = await supabase
        .from('loyalty_programs')
        .update({
          expiration_date: newDate.toISOString(),
          status: 'active',
          expiration_warning_sent: false,
        })
        .eq('id', programId);

      if (error) throw error;

      // Reactivate rewards if program was expired/expiring
      await supabase
        .from('rewards')
        .update({ is_active: true })
        .eq('token_address', tokenAddress.toLowerCase());

      toast.success(`Program "${programName}" extended until ${format(newDate, 'dd.MM.yyyy')}`);
      window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
      onOpenChange(false);
      setSelectedMonths(null);
    } catch (error) {
      console.error('Error extending program:', error);
      toast.error('Failed to extend program');
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Extend Program
          </DialogTitle>
          <DialogDescription>
            Extend "{programName}" expiration date. Current expiration:{' '}
            <span className="font-semibold">{format(currentDate, 'dd.MM.yyyy')}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-4">
          {EXTEND_OPTIONS.map((option) => {
            const previewDate = addMonths(baseDate, option.months);
            return (
              <Button
                key={option.months}
                variant={selectedMonths === option.months ? 'default' : 'outline'}
                className="flex flex-col h-auto py-3 gap-1"
                onClick={() => setSelectedMonths(option.months)}
              >
                <span className="font-semibold">{option.label}</span>
                <span className="text-[10px] opacity-70">
                  until {format(previewDate, 'dd.MM.yyyy')}
                </span>
              </Button>
            );
          })}
        </div>

        {newDate && (
          <div className="text-sm text-center p-2 rounded-md bg-primary/10 text-primary">
            New expiration: <span className="font-bold">{format(newDate, 'dd.MM.yyyy HH:mm')}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExtend} disabled={!selectedMonths || isExtending}>
            {isExtending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extending...
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Extend
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
