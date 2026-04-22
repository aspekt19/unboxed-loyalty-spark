import type * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, Wallet } from 'lucide-react';

export type RecipientInputType = 'wallet' | 'email' | 'phone';

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  inputType: RecipientInputType;
  onInputTypeChange: (t: RecipientInputType) => void;
  disabled?: boolean;
  /** Override for the field label. Defaults vary by tab. */
  walletLabel?: string;
  /** id for the input (for label htmlFor). */
  id?: string;
}

/**
 * Shared recipient input with Wallet / Email / Phone tabs.
 * Resolution to a wallet address is handled by the caller via
 * `useResolveRecipient`. Used by mint, transfer, send-with-round-up flows.
 */
export function RecipientInput({
  value,
  onChange,
  inputType,
  onInputTypeChange,
  disabled,
  walletLabel = 'Recipient Wallet Address',
  id = 'recipient-input',
}: RecipientInputProps) {
  const placeholder =
    inputType === 'email' ? 'recipient@example.com'
    : inputType === 'phone' ? '+1234567890'
    : '0x...';

  const label =
    inputType === 'email' ? 'Recipient Email'
    : inputType === 'phone' ? 'Recipient Phone'
    : walletLabel;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Tabs value={inputType} onValueChange={(v) => { onInputTypeChange(v as RecipientInputType); onChange(''); }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wallet" className="text-xs gap-1">
            <Wallet className="h-3 w-3" /> Wallet
          </TabsTrigger>
          <TabsTrigger value="email" className="text-xs gap-1">
            <Mail className="h-3 w-3" /> Email
          </TabsTrigger>
          <TabsTrigger value="phone" className="text-xs gap-1">
            <Phone className="h-3 w-3" /> Phone
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        type={inputType === 'email' ? 'email' : inputType === 'phone' ? 'tel' : 'text'}
      />
    </div>
  );
}

/**
 * Helper: tells the caller whether the resolved string already looks like a
 * valid 0x address. Useful to skip the resolve-recipient round-trip.
 */
export function isLikelyWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

// Type marker keeps React import retained even after JSX transpile.
export type { React };
