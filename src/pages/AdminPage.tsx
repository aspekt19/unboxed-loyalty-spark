import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import PageTransition from '@/components/PageTransition';
import { PaymentRequestsManagement } from '@/components/admin/PaymentRequestsManagement';
import { PaymentSettingsManagement } from '@/components/admin/PaymentSettingsManagement';
import { PremiumManagement } from '@/components/admin/PremiumManagement';
import { AdminManagement } from '@/components/admin/AdminManagement';
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
      <div className="container mx-auto p-3 sm:p-4 md:p-6 max-w-6xl">
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-3 sm:mb-4 h-8 sm:h-10"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
            <span className="text-xs sm:text-sm">Back to Home</span>
          </Button>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Admin Panel</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage premium subscriptions and payment settings
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="premium" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1">
            <TabsTrigger value="premium" className="text-xs sm:text-sm">Premium</TabsTrigger>
            <TabsTrigger value="admins" className="text-xs sm:text-sm">Admins</TabsTrigger>
            <TabsTrigger value="requests" className="text-xs sm:text-sm">Requests</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="premium">
            <PremiumManagement />
          </TabsContent>

          <TabsContent value="admins">
            <AdminManagement />
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
