import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from 'lucide-react';
import { useState } from 'react';
import { useRoundUpSettings } from '@/hooks/useRoundUpSettings';
import { toast } from 'sonner';

export const RoundUpSettings = () => {
  const [autoInvest, setAutoInvest] = useState(false);
  const [multiplier, setMultiplier] = useState([1]);
  const [strategy, setStrategy] = useState<'0' | '1'>('0');
  const { initializeSettings, updateSettings, isPending } = useRoundUpSettings();

  const handleSave = async () => {
    try {
      await updateSettings(autoInvest, multiplier[0], parseInt(strategy) as 0 | 1);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Round-Up Settings</h3>
          <p className="text-sm text-muted-foreground">Configure your investment preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-invest">Auto-Invest</Label>
            <p className="text-sm text-muted-foreground">
              Automatically invest round-ups
            </p>
          </div>
          <Switch
            id="auto-invest"
            checked={autoInvest}
            onCheckedChange={setAutoInvest}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Round-Up Multiplier</Label>
            <span className="text-sm font-medium">{multiplier[0]}x</span>
          </div>
          <Slider
            value={multiplier}
            onValueChange={setMultiplier}
            min={1}
            max={10}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Multiply your round-up amount (1x - 10x)
          </p>
        </div>

        <div className="space-y-3">
          <Label>Preferred Strategy</Label>
          <Select value={strategy} onValueChange={(v) => setStrategy(v as '0' | '1')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Aave Conservative (Free)</SelectItem>
              <SelectItem value="1">Compound Lending Plus (Premium)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {strategy === '1' && 'Requires Premium subscription ($10/month)'}
            {strategy === '0' && 'Lower risk, moderate returns'}
          </p>
        </div>

        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </Card>
  );
};
