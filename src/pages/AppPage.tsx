import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthPrompt } from '@/components/AuthPrompt';
import { RoleSelector } from '@/components/RoleSelector';
import { CustomerPanel } from '@/components/CustomerPanel';
import { MerchantPanel } from '@/components/MerchantPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PageTransition from '@/components/PageTransition';

export default function AppPage() {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'merchant' | 'customer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserRole = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading role:', error);
        }

        if (data?.role) {
          setSelectedRole(data.role as 'merchant' | 'customer');
        }
      } catch (error) {
        console.error('Error loading role:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserRole();
  }, [user]);

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedRole && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToRoleSelection}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Change Role
                </Button>
              )}
              <h1 className="text-2xl font-bold">
                Loyal Spark
                {selectedRole && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {selectedRole === 'merchant' ? '— Business' : '— Customer'}
                  </span>
                )}
              </h1>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {!user ? (
            <AuthPrompt />
          ) : !selectedRole ? (
            <RoleSelector 
              onRoleSelect={setSelectedRole}
              currentRole={selectedRole || undefined}
            />
          ) : selectedRole === 'customer' ? (
            <CustomerPanel />
          ) : (
            <MerchantPanel />
          )}
        </main>
      </div>
    </PageTransition>
  );
}
