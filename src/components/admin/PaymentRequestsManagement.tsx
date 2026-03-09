import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, ExternalLink, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useState } from 'react';

export const PaymentRequestsManagement = () => {
  const queryClient = useQueryClient();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

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
    mutationFn: async (requestId: string) => {
      setVerifyingId(requestId);
      
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { requestId }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      toast.success('Payment verified successfully! Premium activated. ✅');
      queryClient.invalidateQueries({ queryKey: ['payment-requests-admin'] });
      setVerifyingId(null);
    },
    onError: (error: unknown) => {
      console.error('[PaymentRequests] Error verifying payment:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to verify payment: ${message}`);
      setVerifyingId(null);
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
      console.error('[PaymentRequests] Rejection error:', error);
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
                      onClick={() => verifyPayment.mutate(request.id)}
                      disabled={verifyingId === request.id}
                      className="flex-1"
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {verifyingId === request.id ? 'Verifying on Blockchain...' : 'Verify & Activate'}
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
