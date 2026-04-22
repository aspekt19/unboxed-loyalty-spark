import { Ban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface BannedScreenProps {
  reason: string | null;
  bannedAt: string | null;
}

export function BannedScreen({ reason, bannedAt }: BannedScreenProps) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 p-3 rounded-full bg-destructive/10 w-fit">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Account Suspended</CardTitle>
          <CardDescription>
            Your account has been blocked by an administrator for violating platform rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason && (
            <div className="p-3 rounded-md bg-muted text-sm">
              <div className="font-medium mb-1">Reason:</div>
              <div className="text-muted-foreground">{reason}</div>
            </div>
          )}
          {bannedAt && (
            <p className="text-xs text-muted-foreground text-center">
              Suspended on {format(new Date(bannedAt), 'PPP')}
            </p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            If you believe this is a mistake, please contact support.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
