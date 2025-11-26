import { WalletConnectButton } from '@/components/WalletConnectButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PremiumStatusBadge } from '@/components/PremiumStatusBadge';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { usePremiumPlans } from '@/hooks/usePremiumPlans';
import { usePremiumNotifications } from '@/hooks/usePremiumNotifications';
import { usePremiumActivityLog } from '@/hooks/usePremiumActivityLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Crown, CreditCard, Bell, Activity, Calendar, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import { format } from 'date-fns';
import { useState } from 'react';
import { PremiumUpgradeDialog } from '@/components/roundup/PremiumUpgradeDialog';

const PremiumPage = () => {
  const { isPremium, premiumStatus, paymentSettings } = usePremiumStatus();
  const { data: plans } = usePremiumPlans();
  const { data: notifications } = usePremiumNotifications();
  const { activities } = usePremiumActivityLog();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const getNotificationText = (type: string) => {
    switch (type) {
      case 'warning_7d':
        return 'Your subscription expires in 7 days';
      case 'warning_3d':
        return 'Your subscription expires in 3 days';
      case 'expired':
        return 'Your subscription has expired';
      default:
        return type;
    }
  };

  const getNotificationVariant = (type: string) => {
    switch (type) {
      case 'warning_7d':
        return 'default';
      case 'warning_3d':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </Link>
              <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <span className="text-base sm:text-lg font-bold">Premium</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-6xl">
          <div className="mb-4 sm:mb-6">
            <PremiumStatusBadge />
          </div>

          <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="plans" className="text-xs sm:text-sm">Plans</TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs sm:text-sm">
                <Bell className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs sm:text-sm">
                <Activity className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Current Subscription</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Details of your Premium subscription
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  {isPremium ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-muted-foreground">Status</span>
                        <Badge variant="default" className="gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      </div>
                      {premiumStatus?.started_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground">Started</span>
                          <span className="text-xs sm:text-sm font-medium">
                            {format(new Date(premiumStatus.started_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      {premiumStatus?.expires_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground">Expires</span>
                          <span className="text-xs sm:text-sm font-medium">
                            {format(new Date(premiumStatus.expires_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      <Button className="w-full text-sm" onClick={() => setShowUpgradeDialog(true)}>
                        Renew Subscription
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        You don't have an active Premium subscription
                      </p>
                      <Button className="w-full text-sm" onClick={() => setShowUpgradeDialog(true)}>
                        <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                        Get Premium
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Premium Benefits</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 sm:space-y-3">
                    {[
                      'Access to Round-Up investments',
                      'Advanced analytics',
                      'Priority support',
                      'Exclusive investment strategies',
                      'No withdrawal fees'
                    ].map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                        <span className="text-xs sm:text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plans" className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {plans?.map((plan) => (
                  <Card key={plan.id} className={plan.discount_percentage > 0 ? 'border-primary' : ''}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base sm:text-lg">{plan.name}</CardTitle>
                        {plan.discount_percentage > 0 && (
                          <Badge variant="default" className="text-xs">-{plan.discount_percentage}%</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4">
                      <div>
                        <div className="text-2xl sm:text-3xl font-bold">${plan.price_usdc}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">or {plan.price_eth} ETH</div>
                      </div>
                      <ul className="space-y-1.5 sm:space-y-2">
                        {(plan.features as string[]).map((feature, idx) => (
                          <li key={idx} className="text-xs sm:text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className="w-full text-sm" 
                        variant={plan.discount_percentage > 0 ? 'default' : 'outline'}
                        onClick={() => setShowUpgradeDialog(true)}
                      >
                        Select
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-3 sm:space-y-4">
              {notifications && notifications.length > 0 ? (
                notifications.map((notification) => (
                  <Card key={notification.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs sm:text-sm break-words">
                              {getNotificationText(notification.notification_type)}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {format(new Date(notification.created_at), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getNotificationVariant(notification.notification_type) as any} className="text-xs self-start sm:self-auto flex-shrink-0">
                          {notification.notification_type}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-6 sm:p-8 text-center">
                    <Bell className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                    <p className="text-xs sm:text-sm text-muted-foreground">No notifications yet</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-3 sm:space-y-4">
              {activities && activities.length > 0 ? (
                activities.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                        <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm break-words">{activity.activity_type}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {format(new Date(activity.created_at), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-6 sm:p-8 text-center">
                    <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                    <p className="text-xs sm:text-sm text-muted-foreground">Activity history is empty</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>

        <PremiumUpgradeDialog 
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
        />
      </div>
    </PageTransition>
  );
};

export default PremiumPage;
