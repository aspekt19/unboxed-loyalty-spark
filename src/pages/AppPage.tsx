import { RoleSelector } from '@/components/RoleSelector';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { PremiumUpgradeDialog } from '@/components/roundup/PremiumUpgradeDialog';
import { PremiumStatusBadge } from '@/components/PremiumStatusBadge';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';

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
      <div className="min-h-screen bg-background">
        {/* Header with wallet connection */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex justify-between items-center">
              {/* Logo - clickable to home */}
              <button 
                onClick={() => navigate('/')}
                className="flex items-center gap-2 group"
              >
                <img 
                  src="/new-favicon.png" 
                  alt="Loyal Spark" 
                  className="h-8 w-8 rounded-lg flex-shrink-0 transition-transform group-hover:scale-110" 
                />
                <span className="text-base sm:text-lg font-bold text-foreground">Loyal Spark</span>
              </button>
              
              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => isPremium ? navigate('/premium') : setShowUpgradeDialog(true)}
                  className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                  title={isPremium ? 'Premium активен' : 'Активировать Premium'}
                >
                  <Crown className={`h-5 w-5 ${isPremium ? 'text-yellow-500' : 'text-primary'}`} />
                </button>
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
