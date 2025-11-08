import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Info, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Program {
  token_address: string;
  name: string;
  symbol: string;
}

export function CreateCampaign() {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    token_address: '',
    title: '',
    message: '',
    target_segment: 'all',
    min_balance: '',
    max_balance: '',
  });

  const [previewCount, setPreviewCount] = useState<number>(0);

  useEffect(() => {
    if (!address) return;

    const loadPrograms = async () => {
      const { data } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol')
        .eq('merchant_address', address.toLowerCase());

      setPrograms(data || []);
    };

    loadPrograms();
  }, [address]);

  useEffect(() => {
    if (!formData.token_address || !address) return;

    const loadRecipientCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_customers_by_segment', {
          p_merchant_address: address.toLowerCase(),
          p_token_address: formData.token_address,
          p_segment: formData.target_segment,
          p_min_balance: formData.min_balance ? Number(formData.min_balance) : null,
          p_max_balance: formData.max_balance ? Number(formData.max_balance) : null,
        });

        if (error) throw error;
        setPreviewCount(data?.length || 0);
      } catch (err) {
        console.error('Error loading recipient count:', err);
      }
    };

    loadRecipientCount();
  }, [formData.token_address, formData.target_segment, formData.min_balance, formData.max_balance, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !formData.token_address || !formData.title || !formData.message) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('marketing_campaigns').insert({
        merchant_address: address.toLowerCase(),
        token_address: formData.token_address,
        title: formData.title,
        message: formData.message,
        target_segment: formData.target_segment,
        min_balance: formData.min_balance ? Number(formData.min_balance) : null,
        max_balance: formData.max_balance ? Number(formData.max_balance) : null,
        recipients_count: previewCount,
        status: 'draft',
      });

      if (error) throw error;

      toast.success('Campaign created successfully!');
      setFormData({
        token_address: '',
        title: '',
        message: '',
        target_segment: 'all',
        min_balance: '',
        max_balance: '',
      });
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (!address) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Create Marketing Campaign
        </CardTitle>
        <CardDescription>
          Send targeted messages to your loyalty program customers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="program">Select Program *</Label>
            <Select
              value={formData.token_address}
              onValueChange={(value) =>
                setFormData({ ...formData, token_address: value })
              }
            >
              <SelectTrigger id="program">
                <SelectValue placeholder="Choose a loyalty program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.token_address} value={program.token_address}>
                    {program.name} ({program.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Campaign Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Summer Sale Announcement"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Hi {name}, we have a special offer just for you..."
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use {'{name}'} to personalize with customer name
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment">Target Segment</Label>
            <Select
              value={formData.target_segment}
              onValueChange={(value) =>
                setFormData({ ...formData, target_segment: value })
              }
            >
              <SelectTrigger id="segment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="champions">Champions</SelectItem>
                <SelectItem value="loyal">Loyal Customers</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="lost">Lost Customers</SelectItem>
                <SelectItem value="new">New Customers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-balance">Min Balance (optional)</Label>
              <Input
                id="min-balance"
                type="number"
                min="0"
                value={formData.min_balance}
                onChange={(e) =>
                  setFormData({ ...formData, min_balance: e.target.value })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-balance">Max Balance (optional)</Label>
              <Input
                id="max-balance"
                type="number"
                min="0"
                value={formData.max_balance}
                onChange={(e) =>
                  setFormData({ ...formData, max_balance: e.target.value })
                }
                placeholder="∞"
              />
            </div>
          </div>

          {formData.token_address && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This campaign will reach approximately <strong>{previewCount}</strong>{' '}
                customers
                {previewCount === 0 && ' (No customers match these criteria)'}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={loading || !formData.token_address || previewCount === 0}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
