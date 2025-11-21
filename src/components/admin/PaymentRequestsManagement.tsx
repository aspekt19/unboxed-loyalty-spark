import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, ExternalLink, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const PaymentRequestsManagement = () => {
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['payment-requests-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const verifyPayment = useMutation({
    mutationFn: async ({ requestId, walletAddress }: { requestId: string; walletAddress: string }) => {
      // Update request status
      const { error: updateError } = await supabase
        .from('premium_payment_requests')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Activate premium subscription
      const { error: activateError } = await supabase.rpc('activate_premium_subscription', {
        p_wallet_address: walletAddress,
        p_request_id: requestId,
      });

      if (activateError) throw activateError;
    },
    onSuccess: () => {
      toast.success('Payment verified and premium activated!');
      queryClient.invalidateQueries({ queryKey: ['payment-requests-admin'] });
    },
    onError: (error) => {
      console.error('Verification error:', error);
      toast.error('Failed to verify payment');
    },
  });

  const rejectPayment = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('premium_payment_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment request rejected');
      queryClient.invalidateQueries({ queryKey: ['payment-requests-admin'] });
    },
    onError: (error) => {
      console.error('Rejection error:', error);
      toast.error('Failed to reject payment');
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const processedRequests = requests?.filter(r => r.status !== 'pending') || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Payment Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending payment requests
            </p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Wallet: {request.wallet_address}</p>
                      <p className="text-xs text-muted-foreground">
                        Amount: {request.amount} {request.payment_type.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {format(new Date(request.created_at), 'PPp')}
                      </p>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>

                  {request.transaction_hash && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://basescan.org/tx/${request.transaction_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View on BaseScan
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => verifyPayment.mutate({ 
                        requestId: request.id, 
                        walletAddress: request.wallet_address 
                      })}
                      disabled={verifyPayment.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Verify & Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectPayment.mutate(request.id)}
                      disabled={rejectPayment.isPending}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processed Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No processed requests yet
            </p>
          ) : (
            <div className="space-y-3">
              {processedRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{request.wallet_address}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.amount} {request.payment_type.toUpperCase()}
                    </p>
                  </div>
                  <Badge variant={request.status === 'verified' ? 'default' : 'destructive'}>
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
