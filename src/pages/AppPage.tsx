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

              <WalletConnectButton />
            </div>
          </div>
        </header>

        <RoleSelector onRoleSelect={handleRoleSelect} />
      </div>
    </PageTransition>
  );
}
