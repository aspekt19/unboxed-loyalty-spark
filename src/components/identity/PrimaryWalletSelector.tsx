import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { Wallet, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function PrimaryWalletSelector() {
  const {
    activeWallet,
    connectedWallet,
    isWalletMismatch,
    linkedWallets,
    loading,
    refresh,
    setPrimary,
  } = useActiveWallet();
  const [saving, setSaving] = useState<string | null>(null);

  if (linkedWallets.length <= 1) {
    // Nothing to switch — hide selector entirely
    return null;
  }

  const handleSelect = async (walletAddress: string) => {
    if (walletAddress === activeWallet) return;
    setSaving(walletAddress);
    const result = await setPrimary(walletAddress);
    setSaving(null);
    if (result.ok) {
      toast.success('Основной кошелёк обновлён');
    } else {
      toast.error(result.error ?? 'Не удалось переключить');
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Основной кошелёк
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Обновить"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Выберите, по какому из связанных адресов отображать токены, программы и ваучеры.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isWalletMismatch && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>
              Сейчас подключён <span className="font-mono">{connectedWallet ? shortAddr(connectedWallet) : '—'}</span>,
              а основным выбран <span className="font-mono">{activeWallet ? shortAddr(activeWallet) : '—'}</span>.
              Ончейн-операции (минт, перевод, погашение) будут заблокированы — переподключитесь нужным кошельком.
            </div>
          </div>
        )}

        <RadioGroup value={activeWallet ?? ''} onValueChange={handleSelect}>
          {linkedWallets.map(link => {
            const isConnected = link.wallet_address === connectedWallet;
            const isPrimary = link.is_primary;
            return (
              <Label
                key={link.wallet_address}
                htmlFor={`wallet-${link.wallet_address}`}
                className={`flex items-center gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${
                  isPrimary ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value={link.wallet_address} id={`wallet-${link.wallet_address}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm truncate">{shortAddr(link.wallet_address)}</span>
                    {isPrimary && (
                      <Badge variant="default" className="h-5 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Основной
                      </Badge>
                    )}
                    {isConnected && !isPrimary && (
                      <Badge variant="secondary" className="h-5 text-[10px]">Подключён сейчас</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Привязан через {link.linked_via}
                  </p>
                </div>
                {saving === link.wallet_address && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </Label>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
