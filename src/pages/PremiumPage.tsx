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
import { ru } from 'date-fns/locale';
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
        return 'Ваша подписка истекает через 7 дней';
      case 'warning_3d':
        return 'Ваша подписка истекает через 3 дня';
      case 'expired':
        return 'Ваша подписка истекла';
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
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Crown className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Premium</span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="mb-6">
            <PremiumStatusBadge />
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="plans">Тарифы</TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="h-4 w-4 mr-2" />
                Уведомления
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="h-4 w-4 mr-2" />
                История
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Текущая подписка</CardTitle>
                  <CardDescription>
                    Детали вашей Premium подписки
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isPremium ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Статус</span>
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Активна
                        </Badge>
                      </div>
                      {premiumStatus?.started_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Начало</span>
                          <span className="text-sm font-medium">
                            {format(new Date(premiumStatus.started_at), 'd MMMM yyyy', { locale: ru })}
                          </span>
                        </div>
                      )}
                      {premiumStatus?.expires_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Окончание</span>
                          <span className="text-sm font-medium">
                            {format(new Date(premiumStatus.expires_at), 'd MMMM yyyy', { locale: ru })}
                          </span>
                        </div>
                      )}
                      <Button className="w-full" onClick={() => setShowUpgradeDialog(true)}>
                        Продлить подписку
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        У вас нет активной Premium подписки
                      </p>
                      <Button className="w-full" onClick={() => setShowUpgradeDialog(true)}>
                        <Crown className="h-4 w-4 mr-2" />
                        Оформить Premium
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Преимущества Premium</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      'Доступ к Round-Up инвестициям',
                      'Расширенная аналитика',
                      'Приоритетная поддержка',
                      'Эксклюзивные стратегии инвестирования',
                      'Без комиссий за вывод средств'
                    ].map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plans" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans?.map((plan) => (
                  <Card key={plan.id} className={plan.discount_percentage > 0 ? 'border-primary' : ''}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{plan.name}</CardTitle>
                        {plan.discount_percentage > 0 && (
                          <Badge variant="default">-{plan.discount_percentage}%</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-3xl font-bold">${plan.price_usdc}</div>
                        <div className="text-sm text-muted-foreground">или {plan.price_eth} ETH</div>
                      </div>
                      <ul className="space-y-2">
                        {(plan.features as string[]).map((feature, idx) => (
                          <li key={idx} className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className="w-full" 
                        variant={plan.discount_percentage > 0 ? 'default' : 'outline'}
                        onClick={() => setShowUpgradeDialog(true)}
                      >
                        Выбрать
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              {notifications && notifications.length > 0 ? (
                notifications.map((notification) => (
                  <Card key={notification.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Bell className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {getNotificationText(notification.notification_type)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(notification.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getNotificationVariant(notification.notification_type) as any}>
                          {notification.notification_type}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Уведомлений пока нет</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              {activities && activities.length > 0 ? (
                activities.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{activity.activity_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(activity.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">История активности пуста</p>
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
