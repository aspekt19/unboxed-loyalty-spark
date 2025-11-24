import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const PremiumStatusBadge = () => {
  const { isPremium, premiumStatus, isLoading } = usePremiumStatus();

  if (isLoading) {
    return null;
  }

  if (!isPremium) {
    return null;
  }

  const expiresAt = premiumStatus?.expires_at;
  const formattedDate = expiresAt 
    ? format(new Date(expiresAt), 'd MMMM yyyy', { locale: ru })
    : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Badge variant="default" className="mb-1 gap-1">
                <Crown className="h-3 w-3" />
                Premium
              </Badge>
              <p className="text-xs text-muted-foreground">Активная подписка</p>
            </div>
          </div>
          {formattedDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <div className="text-right">
                <p className="text-xs">Действует до</p>
                <p className="font-medium text-foreground">{formattedDate}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
