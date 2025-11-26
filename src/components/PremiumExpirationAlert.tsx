import { usePremiumNotifications } from '@/hooks/usePremiumNotifications';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Crown, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const PremiumExpirationAlert = ({ onUpgrade }: { onUpgrade: () => void }) => {
  const { data: notifications } = usePremiumNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Находим последнее активное уведомление
  const latestNotification = notifications?.find(
    n => n.notification_type === 'warning_7d' || n.notification_type === 'warning_3d'
  );

  useEffect(() => {
    // Reset dismissed state when new notification appears
    if (latestNotification) {
      setDismissed(false);
    }
  }, [latestNotification?.id]);

  if (!latestNotification || dismissed) {
    return null;
  }

  const isUrgent = latestNotification.notification_type === 'warning_3d';
  const subscription = latestNotification.premium_subscriptions as any;
  const expiresAt = subscription?.expires_at;

  return (
    <Alert variant={isUrgent ? 'destructive' : 'default'} className="relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-sm opacity-70 hover:opacity-100 transition"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-start gap-3">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 mt-0.5" />
        ) : (
          <Crown className="h-5 w-5 mt-0.5" />
        )}
        <div className="flex-1 space-y-2">
          <AlertTitle>
            {isUrgent ? 'Ваша Premium подписка скоро истечёт!' : 'Premium подписка'}
          </AlertTitle>
          <AlertDescription>
            {expiresAt && (
              <p className="mb-2">
                Подписка истекает{' '}
                <strong>{format(new Date(expiresAt), 'd MMMM yyyy', { locale: ru })}</strong>
              </p>
            )}
            <p>
              Продлите подписку сейчас, чтобы не потерять доступ к премиум функциям.
            </p>
          </AlertDescription>
          <Button 
            onClick={onUpgrade} 
            size="sm" 
            variant={isUrgent ? 'default' : 'outline'}
            className="mt-2"
          >
            <Crown className="h-4 w-4 mr-2" />
            Продлить Premium
          </Button>
        </div>
      </div>
    </Alert>
  );
};
