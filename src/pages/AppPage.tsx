import { RoleSelector } from '@/components/RoleSelector';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { PremiumUpgradeDialog } from '@/components/roundup/PremiumUpgradeDialog';
import { PremiumStatusBadge } from '@/components/PremiumStatusBadge';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
import { useState } from 'react';

export default function AppPage() {
  const navigate = useNavigate();
  const { isPremium } = usePremiumStatus();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const handleRoleSelect = (role: 'merchant' | 'customer') => {
    if (role === 'customer') {
      navigate('/customer');
    } else {
      navigate('/merchant');
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        {/* Header with wallet connection */}
        <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
            {/* Mobile: two rows, Desktop: single row */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              {/* Logo - always visible */}
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <img 
                  src="/new-favicon.png" 
                  alt="Loyal Spark" 
                  className="h-8 w-8 sm:h-8 sm:w-8 rounded-lg flex-shrink-0" 
                />
                <span className="text-base sm:text-lg font-bold text-foreground">Loyal Spark</span>
              </div>
              
              {/* Buttons - centered on mobile, right on desktop */}
              <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
                {!isPremium && (
                  <Button 
                    onClick={() => setShowUpgradeDialog(true)}
                    variant="default"
                    size="sm"
                    className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
                  >
                    <Crown className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">Premium</span>
                  </Button>
                )}
                {isPremium && (
                  <Button 
                    onClick={() => navigate('/premium')}
                    variant="outline"
                    size="sm"
                    className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
                  >
                    <Crown className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">Premium</span>
                  </Button>
                )}
                <WalletConnectButton />
              </div>
            </div>
          </div>
        </header>
        
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <PremiumStatusBadge />
        </div>
        
        <RoleSelector onRoleSelect={handleRoleSelect} />
        
        <PremiumUpgradeDialog 
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
        />
      </div>
    </PageTransition>
  );
}
