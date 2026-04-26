import { CreateLoyaltyProgram } from '@/components/CreateLoyaltyProgram';
import { CreatedPrograms } from '@/components/CreatedPrograms';
import { MintTokensDialog } from '@/components/MintTokensDialog';
import { EarnPointsDialog } from '@/components/EarnPointsDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Coins, AlertCircle, AlertTriangle, ShoppingCart } from 'lucide-react';

interface ProgramsTabProps {
  selectedProgram: { name: string; symbol: string; tokenAddress: string; cashbackRate?: number; pointsPerDollar?: number } | null;
  onSelectProgram: (p: ProgramsTabProps['selectedProgram']) => void;
  mintDialogOpen: boolean;
  setMintDialogOpen: (v: boolean) => void;
  earnDialogOpen: boolean;
  setEarnDialogOpen: (v: boolean) => void;
  handleMintSubmit: (recipientAddress: string, amount: string) => Promise<void>;
  isPending: boolean;
  isPaused: boolean;
  isMintingActive: boolean;
  /** When set, component shows programs of this merchant (employee mode) */
  employeeMerchantAddress?: string;
  /** Employee role determines available actions */
  employeeRole?: string;
}

export function ProgramsTab({
  selectedProgram, onSelectProgram,
  mintDialogOpen, setMintDialogOpen,
  earnDialogOpen, setEarnDialogOpen,
  handleMintSubmit, isPending,
  isPaused, isMintingActive,
  employeeMerchantAddress,
  employeeRole,
}: ProgramsTabProps) {
  const isEmployeeMode = !!employeeMerchantAddress;
  // Cashiers can only earn points, admins/managers can also manually mint
  const canManualMint = !isEmployeeMode || employeeRole === 'admin' || employeeRole === 'branch_manager';

  return (
    <div className="space-y-6">
      {!isEmployeeMode && <CreateLoyaltyProgram />}
      <CreatedPrograms
        onSelectProgram={onSelectProgram}
        merchantAddress={employeeMerchantAddress}
        readOnly={isEmployeeMode}
      />

      <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Earn Points (Cashier)
          </CardTitle>
          <CardDescription>
            Scan customer's QR code, enter purchase amount — tokens are credited automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedProgram && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please select a loyalty program above first</AlertDescription>
            </Alert>
          )}
          {selectedProgram && (isPaused || !isMintingActive) && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Program is inactive. Activate it before crediting points.</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={() => setEarnDialogOpen(true)}
            disabled={!selectedProgram || isPaused || !isMintingActive}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
          >
            {selectedProgram ? `Credit ${selectedProgram.symbol} for Purchase` : 'Credit Points'}
          </Button>
        </CardContent>
      </Card>

      {canManualMint && (
        <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Issue Tokens (Manual)
            </CardTitle>
            <CardDescription>Distribute a custom amount of tokens directly</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedProgram && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Please select a loyalty program above before issuing rewards</AlertDescription>
              </Alert>
            )}
            {selectedProgram && (isPaused || !isMintingActive) && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This program is currently inactive. Please activate it using the play button in the Created Programs section before issuing tokens.
                </AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => setMintDialogOpen(true)}
              disabled={!selectedProgram || isPaused || !isMintingActive}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              {selectedProgram ? `Issue ${selectedProgram.symbol}` : 'Issue Tokens'}
            </Button>
          </CardContent>
        </Card>
      )}

      <EarnPointsDialog
        isOpen={earnDialogOpen}
        onClose={() => setEarnDialogOpen(false)}
        onSubmit={handleMintSubmit}
        isPending={isPending}
        cashbackRate={selectedProgram?.cashbackRate ?? 5}
        pointsPerDollar={selectedProgram?.pointsPerDollar ?? 1}
        programSymbol={selectedProgram?.symbol ?? 'tokens'}
        tokenAddress={selectedProgram?.tokenAddress}
      />

      {canManualMint && (
        <MintTokensDialog
          isOpen={mintDialogOpen}
          onClose={() => setMintDialogOpen(false)}
          onSubmit={handleMintSubmit}
          isPending={isPending}
        />
      )}
    </div>
  );
}
