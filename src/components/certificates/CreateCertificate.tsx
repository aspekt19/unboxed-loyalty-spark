import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Gift, Sparkles, Image as ImageIcon, Loader2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createGiftCertificate, uploadCertificateImage } from '@/lib/giftCertificates';
import { format } from 'date-fns';

interface MerchantProgram {
  token_address: string;
  name: string;
  symbol: string;
  points_per_dollar: number;
  status: string;
}

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];
const PRESET_LIFETIMES: Array<{ label: string; days: number | null }> = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: 'No expiry', days: null },
];

export function CreateCertificate({ onCreated }: { onCreated?: () => void }) {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<MerchantProgram[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [usdAmount, setUsdAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [rateMode, setRateMode] = useState<'program' | 'custom'>('program');
  const [customRate, setCustomRate] = useState<string>('');
  const [maxRedemption, setMaxRedemption] = useState<number>(50);
  const [title, setTitle] = useState<string>('Welcome Gift');
  const [description, setDescription] = useState<string>('');
  const [lifetimeDays, setLifetimeDays] = useState<number | null>(90);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol, points_per_dollar, status')
        .eq('merchant_address', address.toLowerCase())
        .neq('status', 'expired')
        .order('created_at', { ascending: false });
      if (cancelled || error) return;
      const rows = (data ?? []) as MerchantProgram[];
      setPrograms(rows);
      if (rows.length && !selectedToken) setSelectedToken(rows[0].token_address);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const program = programs.find((p) => p.token_address === selectedToken);
  const finalUsd = customAmount ? Number(customAmount) : usdAmount;
  const programRate = program ? Number(program.points_per_dollar) : 1;
  const finalRate = rateMode === 'custom'
    ? (customRate ? Number(customRate) : programRate)
    : programRate;
  const finalTokens = Number((finalUsd * finalRate).toFixed(4));

  const handleSubmit = async () => {
    if (!address) { toast.error('Connect your wallet'); return; }
    if (!program) { toast.error('Select a loyalty program'); return; }
    if (!finalUsd || finalUsd <= 0) { toast.error('Enter a positive USD amount'); return; }
    if (!finalRate || finalRate <= 0) { toast.error('Rate must be positive'); return; }
    if (!title.trim()) { toast.error('Title is required'); return; }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadCertificateImage(address, imageFile);
        if (!imageUrl) toast.warning('Image upload failed, certificate created without it');
      }

      const expiresAt = lifetimeDays
        ? new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const cert = await createGiftCertificate({
        merchantAddress: address,
        tokenAddress: program.token_address,
        tokenSymbol: program.symbol,
        usdAmount: finalUsd,
        pointsPerDollar: finalRate,
        maxRedemptionPercent: maxRedemption,
        title: title.trim(),
        description: description.trim() || undefined,
        imageUrl,
        expiresAt,
      });

      toast.success(`Certificate ${cert.code} created!`);
      // Reset minimal fields
      setCustomAmount('');
      setImageFile(null);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create certificate');
    } finally {
      setSubmitting(false);
    }
  };

  if (!programs.length) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Create a loyalty program first — gift certificates issue tokens of an existing program.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Create Gift Certificate
        </CardTitle>
        <CardDescription>
          Issue a welcome or gift certificate for a fixed dollar value. Customers redeem it by scanning a QR or entering a 6-character code — tokens land directly in their wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Program */}
        <div className="space-y-2">
          <Label>Loyalty program</Label>
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.token_address} value={p.token_address}>
                  {p.name} ({p.symbol}) — {p.points_per_dollar} pts/$
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label>Certificate value (USD)</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map((amt) => (
              <Button
                key={amt}
                type="button"
                variant={!customAmount && usdAmount === amt ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setUsdAmount(amt); setCustomAmount(''); }}
              >
                ${amt}
              </Button>
            ))}
            <Input
              type="number"
              min={1}
              step="0.01"
              placeholder="Custom $"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-32"
            />
          </div>
        </div>

        {/* Rate */}
        <div className="space-y-2">
          <Label>Conversion rate</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={rateMode === 'program' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRateMode('program')}
            >
              Use program rate ({programRate} pts/$)
            </Button>
            <Button
              type="button"
              variant={rateMode === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRateMode('custom')}
            >
              Custom
            </Button>
          </div>
          {rateMode === 'custom' && (
            <Input
              type="number"
              min={0.01}
              step="0.01"
              placeholder={`Points per $1 (e.g. ${programRate})`}
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
            />
          )}
        </div>

        {/* Max redemption % */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Max redemption per purchase</Label>
            <Badge variant="secondary">{maxRedemption}%</Badge>
          </div>
          <Slider
            value={[maxRedemption]}
            onValueChange={(v) => setMaxRedemption(v[0])}
            min={5}
            max={100}
            step={5}
          />
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            Customer can use these tokens to cover up to <strong>{maxRedemption}%</strong> of any purchase. (UDS-style cap, displayed on the certificate.)
          </p>
        </div>

        {/* Title + description */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-2">
            <Label>Valid for</Label>
            <Select
              value={lifetimeDays === null ? 'none' : String(lifetimeDays)}
              onValueChange={(v) => setLifetimeDays(v === 'none' ? null : Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESET_LIFETIMES.map((l) => (
                  <SelectItem key={l.label} value={l.days === null ? 'none' : String(l.days)}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A welcome gift for new customers!"
            maxLength={300}
            rows={2}
          />
        </div>

        {/* Image */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Cover image (optional)
          </Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
          {imageFile && (
            <p className="text-xs text-muted-foreground">{imageFile.name}</p>
          )}
        </div>

        {/* Preview summary */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Certificate value:</span>
            <strong>${finalUsd}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate:</span>
            <span>{finalRate} {program?.symbol}/$</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer receives:</span>
            <strong className="text-primary">{finalTokens} {program?.symbol}</strong>
          </div>
          {lifetimeDays && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires:</span>
              <span>{format(new Date(Date.now() + lifetimeDays * 86400000), 'PP')}</span>
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
          ) : (
            <><Gift className="h-4 w-4 mr-2" /> Create Certificate</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
