/**
 * Zod validation schemas for form inputs across the application.
 *
 * Centralises validation rules so they stay consistent between
 * merchant-facing and customer-facing forms.
 *
 * @module validationSchemas
 */

import { z } from 'zod';

/** Reusable Ethereum address validator */
const ethAddressField = (label = 'Ethereum address') =>
  z.string().regex(/^0x[a-fA-F0-9]{40}$/i, `Invalid ${label}`);

/**
 * Schema for creating or editing a reward.
 *
 * Used in the merchant reward creation form.
 */
export const rewardSchema = z.object({
  tokenAddress: ethAddressField('token address'),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be less than 500 characters'),
  cost: z
    .number()
    .positive('Cost must be greater than 0')
    .max(1_000_000, 'Cost exceeds maximum of 1,000,000'),
});

/**
 * Schema for voucher activation.
 *
 * Validates the token address, reward reference, and token cost
 * before a voucher is minted on-chain.
 */
export const voucherSchema = z.object({
  tokenAddress: ethAddressField('token address'),
  rewardId: z.string().uuid('Invalid reward ID'),
  cost: z
    .number()
    .positive('Cost must be greater than 0')
    .max(1_000_000, 'Cost exceeds maximum'),
});

/** Maximum mintable amount per single transaction */
const MAX_MINT_AMOUNT = 10_000_000;

/**
 * Schema for the "Mint Tokens" merchant form.
 *
 * Ensures the recipient is a valid address and the amount
 * is within safe ERC-20 decimal bounds (up to 18 decimals).
 */
export const mintTokensSchema = z.object({
  recipientAddress: ethAddressField('recipient address').transform((v) => v.trim()),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,18})?$/, 'Amount must be a valid number with up to 18 decimals')
    .refine((val) => {
      const num = parseFloat(val);
      return num > 0 && num <= MAX_MINT_AMOUNT;
    }, `Amount must be between 0 and ${MAX_MINT_AMOUNT.toLocaleString()}`)
    .refine((val) => !isNaN(parseFloat(val)), 'Invalid amount format'),
  tokenAddress: ethAddressField('token address'),
});

/** Inferred TypeScript types from schemas */
export type RewardFormData = z.infer<typeof rewardSchema>;
export type VoucherFormData = z.infer<typeof voucherSchema>;
export type MintTokensFormData = z.infer<typeof mintTokensSchema>;
