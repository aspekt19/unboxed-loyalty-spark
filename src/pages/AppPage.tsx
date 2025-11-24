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
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-8 w-8 rounded-lg" 
              />
              <span className="text-lg font-bold text-foreground">Loyal Spark</span>
            </div>
            <div className="flex items-center gap-3">
              {!isPremium && (
                <Button 
                  onClick={() => setShowUpgradeDialog(true)}
                  variant="default"
                  size="sm"
                  className="gap-2"
                >
                  <Crown className="h-4 w-4" />
                  Premium
                </Button>
              )}
              <WalletConnectButton />
            </div>
          </div>
        </header>
        
        <div className="container mx-auto px-4 py-6">
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
