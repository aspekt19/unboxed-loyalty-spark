import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import PageTransition from '@/components/PageTransition';
import { PaymentRequestsManagement } from '@/components/admin/PaymentRequestsManagement';
import { PaymentSettingsManagement } from '@/components/admin/PaymentSettingsManagement';
import { PremiumManagement } from '@/components/admin/PremiumManagement';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminPage = () => {
  const { isAdmin, isLoading } = useAdminStatus();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <PageTransition>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              <p className="text-muted-foreground">
                Manage premium subscriptions and payment settings
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="premium" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="premium">Premium</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="premium">
            <PremiumManagement />
          </TabsContent>

          <TabsContent value="requests">
            <PaymentRequestsManagement />
          </TabsContent>

          <TabsContent value="settings">
            <PaymentSettingsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default AdminPage;
