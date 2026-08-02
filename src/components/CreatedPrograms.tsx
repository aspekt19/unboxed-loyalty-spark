import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gift, Check, Loader2, Clock, ChevronLeft, ChevronRight, CalendarPlus, Calculator } from 'lucide-react';
import { useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useBurnAllTokens } from '@/hooks/useBurnAllTokens';
import { useToggleProgramStatus } from '@/hooks/useToggleProgramStatus';
import { useTokenStats } from '@/hooks/useTokenStats';
import { ProgramStatusBadge } from './ProgramStatusBadge';
import { ProgramControlButtons } from './ProgramControlButtons';
import { ProgramActivationNote } from './ProgramActivationNote';
import { ExtendProgramDialog } from './ExtendProgramDialog';
import { useMerchantPrograms } from '@/hooks/useMerchantPrograms';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import useEmblaCarousel from 'embla-carousel-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFarcasterHaptics } from '@/hooks/useFarcasterHaptics';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LoyaltyProgram {
  id?: string;
  name: string;
  symbol: string;
  timestamp: number;
  tokenAddress?: string;
  expirationDate?: string;
  status?: 'active' | 'expiring_soon' | 'expired' | 'paused' | 'inactive';
  cashbackRate?: number;
  pointsPerDollar?: number;
  tokenStandard?: 'erc20' | 'b20';
}

interface DbProgramRow {
  id: string;
  name: string;
  symbol: string;
  created_at: string;
  token_address: string;
  expiration_date?: string;
  status?: string;
  cashback_rate?: number;
  points_per_dollar?: number;
  token_standard?: string;
}

/** Map DB row to LoyaltyProgram */
function mapDbProgram(prog: DbProgramRow): LoyaltyProgram {
  return {
    id: prog.id,
    name: prog.name,
    symbol: prog.symbol,
    timestamp: new Date(prog.created_at).getTime(),
    tokenAddress: prog.token_address,
    expirationDate: prog.expiration_date,
    status: prog.status as LoyaltyProgram['status'],
    cashbackRate: prog.cashback_rate ?? 5,
    pointsPerDollar: prog.points_per_dollar ?? 1,
    tokenStandard: (prog.token_standard === 'b20' ? 'b20' : 'erc20'),
  };
}


export function CreatedPrograms({ onSelectProgram, merchantAddress: merchantAddressOverride, readOnly }: { onSelectProgram: (program: LoyaltyProgram & { tokenAddress: string }) => void; merchantAddress?: string; readOnly?: boolean }) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [toggledProgram, setToggledProgram] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<{
    program: LoyaltyProgram;
    operation: 'pause' | 'activate';
    step: 'unpause' | 'minting' | 'complete';
  } | null>(null);

  const { address } = useAccount();
  const { burnAllTokens, isBurning, progress } = useBurnAllTokens();
  const { pauseProgram, unpauseUtility, enableMinting, isPending: isToggling, isSuccess: toggleSuccess, hash } = useToggleProgramStatus();
  const effectiveMerchantAddress = merchantAddressOverride || address?.toLowerCase();
  const { data: merchantProgramRows = [] } = useMerchantPrograms(effectiveMerchantAddress);
  const { tokenStats, isLoadingStats } = useTokenStats(programs);
  const isMobile = useIsMobile();
  const { selectionChanged } = useFarcasterHaptics();
  const lastProcessedHash = useRef<string | null>(null);

  // Embla carousel for mobile swipe
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    const newSlide = emblaApi.selectedScrollSnap();
    if (newSlide !== currentSlide) {
      selectionChanged();
    }
    setCurrentSlide(newSlide);
  }, [emblaApi, currentSlide, selectionChanged]);
  
  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Clear programs on wallet disconnect
  useEffect(() => {
    if (!address && !merchantAddressOverride) {
      setPrograms([]);
      setSelectedProgram(null);
    }
  }, [address, merchantAddressOverride]);

  // Shared merchant programs cache (TQ) — replaces per-mount select* + duplicate realtime
  useEffect(() => {
    if (!effectiveMerchantAddress) return;
    const mapped = merchantProgramRows.map((row) =>
      mapDbProgram({
        id: row.id,
        name: row.name,
        symbol: row.symbol,
        created_at: row.created_at || new Date().toISOString(),
        token_address: row.token_address || '',
        expiration_date: row.expiration_date || undefined,
        status: row.status,
        cashback_rate: row.cashback_rate ?? undefined,
        points_per_dollar: row.points_per_dollar ?? undefined,
        token_standard: row.token_standard ?? undefined,
      }),
    );
    setPrograms(mapped);
    if (!merchantAddressOverride) {
      localStorage.setItem('loyaltyPrograms', JSON.stringify(mapped));
    }
  }, [effectiveMerchantAddress, merchantProgramRows, merchantAddressOverride]);

  const handleSelectProgram = (program: LoyaltyProgram, index: number) => {
    if (!program.tokenAddress) {
      toast.error('This program is still pending. Please wait for the transaction to complete.');
      return;
    }
    setSelectedProgram(index.toString());
    onSelectProgram(program as LoyaltyProgram & { tokenAddress: string });
    toast.success(`Selected ${program.name}`);
  };

  const handleToggleProgram = async (program: LoyaltyProgram, shouldPause: boolean) => {
    if (!program.tokenAddress || !program.id) return;

    // B20 programs have no on-chain pause / minting flags — DB-only toggle.
    if (program.tokenStandard === 'b20') {
      const newStatus = shouldPause ? 'paused' : 'active';
      try {
        const { error } = await supabase
          .from('loyalty_programs')
          .update({ status: newStatus })
          .eq('id', program.id);
        if (error) throw error;
        await supabase
          .from('rewards')
          .update({ is_active: !shouldPause })
          .eq('token_address', program.tokenAddress.toLowerCase())
          .eq('merchant_address', address!.toLowerCase());
        window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
        window.dispatchEvent(new Event('rewardsUpdated'));
        toast.success(shouldPause ? 'Program paused' : 'Program activated');
      } catch (err) {
        console.error('[CreatedPrograms] B20 toggle error:', err);
        toast.error('Failed to update program status');
      }
      return;
    }

    setToggledProgram(program.tokenAddress);

    try {
      if (shouldPause) {
        setPendingOperation({ program, operation: 'pause', step: 'complete' });
        await pauseProgram(program.tokenAddress as `0x${string}`);
      } else {
        setPendingOperation({ program, operation: 'activate', step: 'unpause' });
        await unpauseUtility(program.tokenAddress as `0x${string}`);
      }
    } catch (error) {
      console.error('[CreatedPrograms] Toggle error:', error);
      toast.error('Failed to change program status');
      setToggledProgram(null);
      setPendingOperation(null);
    }
  };


  // Handle successful toggle transaction
  useEffect(() => {
    const handleSuccess = async () => {
      if (!toggleSuccess || !pendingOperation || !address || !hash) return;
      if (lastProcessedHash.current === hash) return;
      
      lastProcessedHash.current = hash;
      const { program, operation, step } = pendingOperation;
      
      // If activating and just completed unpause, now enable minting
      if (operation === 'activate' && step === 'unpause') {
        setPendingOperation({ program, operation: 'activate', step: 'minting' });
        try {
          await enableMinting(program.tokenAddress as `0x${string}`);
          return;
        } catch (error) {
          console.error('[CreatedPrograms] Enable minting error:', error);
          toast.error('Failed to enable minting. Please try again.');
          setToggledProgram(null);
          setPendingOperation(null);
          return;
        }
      }
      
      // Update DB after all steps complete
      const isPause = operation === 'pause';
      
      try {
        const { data: updateSuccess, error: programError } = await supabase.rpc(
          'update_program_status',
          {
            p_token_address: program.tokenAddress!,
            p_merchant_address: address,
            p_new_status: isPause ? 'paused' : 'active'
          }
        );
        
        if (programError) {
          console.error('[CreatedPrograms] Status update error:', programError.message);
          toast.error('Failed to update program status in database');
          return;
        }
        
        if (!updateSuccess) {
          toast.error('Failed to update program status');
          return;
        }
        
        // Update rewards
        const { error: rewardsError } = await supabase
          .from('rewards')
          .update({ is_active: !isPause })
          .eq('token_address', program.tokenAddress!.toLowerCase())
          .eq('merchant_address', address.toLowerCase());
        
        if (rewardsError) {
          console.error('[CreatedPrograms] Rewards update error:', rewardsError.message);
        }
        
        // Update vouchers
        const { error: vouchersError } = await supabase
          .from('vouchers')
          .update({ status: isPause ? 'expired' : 'active' })
          .eq('token_address', program.tokenAddress!.toLowerCase())
          .eq('status', isPause ? 'active' : 'expired');
        
        if (vouchersError) {
          console.error('[CreatedPrograms] Vouchers update error:', vouchersError.message);
        }
        
        // Reload programs from DB
        const { data: updatedPrograms, error: reloadError } = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('merchant_address', address.toLowerCase())
          .order('created_at', { ascending: false });
        
        if (!reloadError && updatedPrograms) {
          const reloaded = updatedPrograms.map(mapDbProgram);
          setPrograms(reloaded);
          localStorage.setItem('loyaltyPrograms', JSON.stringify(reloaded));
        }
        
        window.dispatchEvent(new Event('rewardsUpdated'));
        window.dispatchEvent(new Event('vouchersUpdated'));
        window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
        
        toast.success(
          isPause 
            ? 'Program paused. Rewards and vouchers are now inactive.' 
            : 'Program activated successfully! Rewards and vouchers are now active.'
        );
      } catch (error) {
        console.error('[CreatedPrograms] DB update error:', error);
        toast.error('Failed to update program status');
      } finally {
        setToggledProgram(null);
        setPendingOperation(null);
      }
    };
    
    handleSuccess();
  }, [toggleSuccess, pendingOperation, address, enableMinting, hash]);

  const handleDeleteProgram = async (programId: string, burnTokens: boolean) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;
    
    setDeletingProgramId(programId);
    
    try {
      if (program.tokenAddress) {
        if (burnTokens) {
          toast.info('Burning tokens from all users...');
          const burnSuccess = await burnAllTokens(program.tokenAddress, CONTRACTS.LOYAL_SPARK_ERC20.abi);
          if (!burnSuccess) {
            toast.warning('Some tokens could not be burned, but continuing with program closure');
          }
        }
        
        const { error: vouchersError } = await supabase
          .from('vouchers')
          .update({ status: 'expired' })
          .eq('token_address', program.tokenAddress.toLowerCase())
          .eq('status', 'active');
        
        if (vouchersError) {
          console.error('[CreatedPrograms] Close vouchers error:', vouchersError.message);
        }
        
        window.dispatchEvent(new Event('rewardsUpdated'));
        window.dispatchEvent(new Event('vouchersUpdated'));
      }
      
      const { error: deleteError } = await supabase
        .from('loyalty_programs')
        .delete()
        .eq('id', programId);
      
      if (deleteError) {
        console.error('[CreatedPrograms] Delete error:', deleteError.message);
        toast.error('Failed to delete program from database');
        return;
      }
      
      const updatedPrograms = programs.filter(p => p.id !== programId);
      setPrograms(updatedPrograms);
      localStorage.setItem('loyaltyPrograms', JSON.stringify(updatedPrograms));
      
      if (selectedProgram === programId) {
        setSelectedProgram(null);
      }
      
      toast.success('Program closed successfully. Rewards and vouchers are now hidden.');
    } catch (error) {
      console.error('[CreatedPrograms] Delete error:', error);
      toast.error('Failed to close program');
    } finally {
      setDeletingProgramId(null);
    }
  };

  if (programs.length === 0) return null;

  const programCards = programs.map((program, index) => (
    <ProgramCard
      key={program.id || index}
      program={program}
      index={index}
      selectedProgram={selectedProgram}
      tokenStats={tokenStats}
      isLoadingStats={isLoadingStats}
      isToggling={isToggling}
      toggledProgram={toggledProgram}
      deletingProgramId={deletingProgramId}
      isBurning={isBurning}
      progress={progress}
      deleteDialogOpen={deleteDialogOpen}
      onSelectProgram={handleSelectProgram}
      onToggleProgram={handleToggleProgram}
      onDeleteProgram={handleDeleteProgram}
      setDeleteDialogOpen={setDeleteDialogOpen}
      readOnly={readOnly}
    />
  ));

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          {readOnly ? 'Store Programs' : 'Your Loyalty Programs'}
        </CardTitle>
        <CardDescription>{readOnly ? 'Select a program to credit points' : 'Select a program to issue rewards'}</CardDescription>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          <div className="relative">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex gap-3">
                {programs.map((program, index) => (
                  <div key={program.id || index} className="flex-[0_0_90%] min-w-0">
                    <ProgramCard
                      program={program}
                      index={index}
                      selectedProgram={selectedProgram}
                      tokenStats={tokenStats}
                      isLoadingStats={isLoadingStats}
                      isToggling={isToggling}
                      toggledProgram={toggledProgram}
                      deletingProgramId={deletingProgramId}
                      isBurning={isBurning}
                      progress={progress}
                      deleteDialogOpen={deleteDialogOpen}
                      onSelectProgram={handleSelectProgram}
                      onToggleProgram={handleToggleProgram}
                      onDeleteProgram={handleDeleteProgram}
                      setDeleteDialogOpen={setDeleteDialogOpen}
                      readOnly={readOnly}
                    />
                  </div>
                ))}
              </div>
            </div>
            {programs.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {programs.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => emblaApi?.scrollTo(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentSlide === index 
                        ? 'bg-primary w-4' 
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
            {programs.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 h-8 w-8 rounded-full bg-background/80 shadow-md ${
                    !canScrollPrev ? 'opacity-30 pointer-events-none' : ''
                  }`}
                  onClick={() => emblaApi?.scrollPrev()}
                  disabled={!canScrollPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 h-8 w-8 rounded-full bg-background/80 shadow-md ${
                    !canScrollNext ? 'opacity-30 pointer-events-none' : ''
                  }`}
                  onClick={() => emblaApi?.scrollNext()}
                  disabled={!canScrollNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="space-y-3 pb-4 pr-4">
              {programCards}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ── ProgramCard (extracted sub-component) ──

interface TokenStats {
  [tokenAddress: string]: {
    totalIssued: number;
    merchantBalance: number;
    holdersBalance: number;
  };
}

interface ProgramCardProps {
  program: LoyaltyProgram;
  index: number;
  selectedProgram: string | null;
  tokenStats: TokenStats;
  isLoadingStats: boolean;
  isToggling: boolean;
  toggledProgram: string | null;
  deletingProgramId: string | null;
  isBurning: boolean;
  progress: { current: number; total: number };
  deleteDialogOpen: string | null;
  onSelectProgram: (program: LoyaltyProgram, index: number) => void;
  onToggleProgram: (program: LoyaltyProgram, shouldPause: boolean) => void;
  onDeleteProgram: (programId: string, burnTokens: boolean) => void;
  setDeleteDialogOpen: (id: string | null) => void;
  readOnly?: boolean;
}

function ProgramCard({
  program,
  index,
  selectedProgram,
  tokenStats,
  isLoadingStats,
  isToggling,
  toggledProgram,
  deletingProgramId,
  isBurning,
  progress,
  deleteDialogOpen,
  onSelectProgram,
  onToggleProgram,
  onDeleteProgram,
  setDeleteDialogOpen,
  readOnly,
}: ProgramCardProps) {
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [editingCashback, setEditingCashback] = useState(false);
  const [cashbackValue, setCashbackValue] = useState(program.cashbackRate ?? 5);
  const [savingCashback, setSavingCashback] = useState(false);
  const [editingPoints, setEditingPoints] = useState(false);
  const [pointsValue, setPointsValue] = useState(program.pointsPerDollar ?? 1);
  const [savingPoints, setSavingPoints] = useState(false);

  const handleSavePoints = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!program.id) return;
    setSavingPoints(true);
    try {
      const { error } = await supabase
        .from('loyalty_programs')
        .update({ points_per_dollar: pointsValue })
        .eq('id', program.id);
      if (error) throw error;
      program.pointsPerDollar = pointsValue;
      toast.success(`Points rate updated to ${pointsValue} per $1`);
      setEditingPoints(false);
      window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
    } catch (err) {
      console.error('[ProgramCard] Points update error:', err);
      toast.error('Failed to update points rate');
    } finally {
      setSavingPoints(false);
    }
  };

  const handleSaveCashback = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!program.id) return;
    setSavingCashback(true);
    try {
      const { error } = await supabase
        .from('loyalty_programs')
        .update({ cashback_rate: cashbackValue })
        .eq('id', program.id);
      if (error) throw error;
      program.cashbackRate = cashbackValue;
      toast.success(`Cashback rate updated to ${cashbackValue}%`);
      setEditingCashback(false);
      window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
    } catch (err) {
      console.error('[ProgramCard] Cashback update error:', err);
      toast.error('Failed to update cashback rate');
    } finally {
      setSavingCashback(false);
    }
  };

  return (
    <>
      <div
        onClick={() => onSelectProgram(program, index)}
        className={`p-3 rounded-lg border-2 transition-all ${
          program.tokenAddress ? 'cursor-pointer hover:border-primary/50 hover:shadow-md' : 'cursor-not-allowed opacity-50'
        } ${
          selectedProgram === index.toString()
            ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20'
            : 'border-border'
        }`}
      >
        <div className="space-y-2">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-base truncate">{program.name}</h3>
                {selectedProgram === index.toString() && (
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground flex-shrink-0">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Symbol: {program.symbol}</p>
              {program.tokenAddress && (
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono flex items-center gap-1">
                  <span>{program.tokenAddress.slice(0, 6)}...{program.tokenAddress.slice(-4)}</span>
                  {program.tokenStandard === 'b20' && (
                    <span className="px-1 py-[1px] rounded bg-primary/10 text-primary text-[9px] font-semibold uppercase tracking-wider">
                      B20
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ProgramStatusBadge 
                tokenAddress={program.tokenAddress}
                fallbackStatus={program.status || (program.tokenAddress ? 'active' : 'pending')}
                expirationDate={program.expirationDate}
                tokenStandard={program.tokenStandard}
                preferDbStatus
              />
              {program.tokenAddress && !readOnly && (
                <ProgramControlButtons
                  tokenAddress={program.tokenAddress}
                  isToggling={isToggling && toggledProgram === program.tokenAddress}
                  isDeleting={deletingProgramId === program.id}
                  onPause={() => onToggleProgram(program, true)}
                  onActivate={() => onToggleProgram(program, false)}
                  onDelete={() => program.id && setDeleteDialogOpen(program.id)}
                  tokenStandard={program.tokenStandard}
                />
              )}
            </div>
          </div>
          
          {program.tokenAddress && (
            <ProgramActivationNote
              tokenAddress={program.tokenAddress}
              tokenStandard={program.tokenStandard}
            />
          )}

          
          {program.tokenAddress && (
            <>
              {isLoadingStats ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading balances...</span>
                </div>
              ) : tokenStats[program.tokenAddress] ? (
                <div className="space-y-0.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Issued: </span>
                    <span className="font-semibold text-primary">
                      {tokenStats[program.tokenAddress].totalIssued.toFixed(2)} {program.symbol}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Your Balance: </span>
                    <span className="font-semibold">
                      {tokenStats[program.tokenAddress].merchantBalance.toFixed(2)} {program.symbol}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Users Balance: </span>
                    <span className="font-semibold">
                      {tokenStats[program.tokenAddress].holdersBalance.toFixed(2)} {program.symbol}
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          )}
          
          {program.expirationDate && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="flex-1">Expires: {format(new Date(program.expirationDate), 'dd.MM.yyyy')}</span>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-primary hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExtendDialogOpen(true);
                  }}
                >
                  <CalendarPlus className="h-3 w-3 mr-0.5" />
                  Extend
                </Button>
              )}
            </div>
          )}

          {/* Cashback Rate */}
          {readOnly ? (
            <>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calculator className="h-3 w-3" />
                <span>Cashback: {program.cashbackRate ?? 5}%</span>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calculator className="h-3 w-3" />
                <span>Rate: {program.pointsPerDollar ?? 1} pts/$1</span>
              </div>
            </>
          ) : (
            <>
              {/* Cashback Rate */}
              <div className="text-[10px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                {editingCashback ? (
                  <div className="space-y-1.5 p-2 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Cashback Rate</span>
                      <span className="font-bold text-primary text-xs">{cashbackValue}%</span>
                    </div>
                    <Slider
                      value={[cashbackValue]}
                      onValueChange={([v]) => setCashbackValue(v)}
                      min={1}
                      max={50}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]"
                        onClick={(e) => { e.stopPropagation(); setEditingCashback(false); setCashbackValue(program.cashbackRate ?? 5); }}>Cancel</Button>
                      <Button size="sm" className="h-5 px-2 text-[10px]" onClick={handleSaveCashback} disabled={savingCashback}>
                        {savingCashback ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button className="flex items-center gap-1 hover:text-primary transition-colors" onClick={() => setEditingCashback(true)}>
                    <Calculator className="h-3 w-3" />
                    <span>Cashback: {program.cashbackRate ?? 5}%</span>
                  </button>
                )}
              </div>
              {/* Points Per Dollar */}
              <div className="text-[10px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                {editingPoints ? (
                  <div className="space-y-1.5 p-2 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Points per $1</span>
                      <span className="font-bold text-primary text-xs">{pointsValue}</span>
                    </div>
                    <Slider value={[pointsValue]} onValueChange={([v]) => setPointsValue(v)} min={1} max={100} step={1} className="w-full" />
                    <p className="text-muted-foreground/70">
                      Example: $100 purchase × {cashbackValue}% = ${(100 * cashbackValue / 100).toFixed(2)} × {pointsValue} = {(100 * cashbackValue / 100 * pointsValue).toFixed(0)} points
                    </p>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]"
                        onClick={(e) => { e.stopPropagation(); setEditingPoints(false); setPointsValue(program.pointsPerDollar ?? 1); }}>Cancel</Button>
                      <Button size="sm" className="h-5 px-2 text-[10px]" onClick={handleSavePoints} disabled={savingPoints}>
                        {savingPoints ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button className="flex items-center gap-1 hover:text-primary transition-colors" onClick={() => setEditingPoints(true)}>
                    <Calculator className="h-3 w-3" />
                    <span>Rate: {program.pointsPerDollar ?? 1} pts/$1</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {program.id && program.expirationDate && program.tokenAddress && (
        <ExtendProgramDialog
          open={extendDialogOpen}
          onOpenChange={setExtendDialogOpen}
          programId={program.id}
          programName={program.name}
          currentExpirationDate={program.expirationDate}
          tokenAddress={program.tokenAddress}
        />
      )}
      
      {program.tokenAddress && (
        <AlertDialog open={deleteDialogOpen === program.id} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Close Loyalty Program?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Choose how to close "{program.name}":
                </p>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">This action will:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Deactivate all rewards for this program</li>
                    <li>Mark all active vouchers as expired</li>
                    <li>Remove the program from your console</li>
                  </ul>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    💡 <strong>Burn tokens option:</strong> Will attempt to burn tokens from all users who have approved your address. Users who haven't approved will keep their tokens.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => program.id && onDeleteProgram(program.id, false)}
                className="bg-amber-600 text-white hover:bg-amber-700"
                disabled={deletingProgramId === program.id}
              >
                {deletingProgramId === program.id && !isBurning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Closing...</>
                ) : (
                  'Close (Keep Tokens)'
                )}
              </AlertDialogAction>
              <AlertDialogAction
                onClick={() => program.id && onDeleteProgram(program.id, true)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletingProgramId === program.id}
              >
                {isBurning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Burning {progress.current}/{progress.total}...</>
                ) : deletingProgramId === program.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                ) : (
                  'Close & Burn Tokens'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
