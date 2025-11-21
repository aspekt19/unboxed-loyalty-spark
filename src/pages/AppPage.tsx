import { RoleSelector } from '@/components/RoleSelector';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import { WalletConnectButton } from '@/components/WalletConnectButton';

export default function AppPage() {
  const navigate = useNavigate();

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
            <WalletConnectButton />
          </div>
        </header>
        
        <RoleSelector onRoleSelect={handleRoleSelect} />
      </div>
    </PageTransition>
  );
}
