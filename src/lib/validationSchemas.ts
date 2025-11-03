import { z } from 'zod';

export const rewardSchema = z.object({
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
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
    .max(1000000, 'Cost exceeds maximum of 1,000,000'),
});

export const voucherSchema = z.object({
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  rewardId: z.string().uuid('Invalid reward ID'),
  cost: z
    .number()
    .positive('Cost must be greater than 0')
    .max(1000000, 'Cost exceeds maximum'),
});

export const mintTokensSchema = z.object({
  recipientAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid Ethereum address format'),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,18})?$/, 'Amount must be a valid number with up to 18 decimals')
    .refine(val => {
      const num = parseFloat(val);
      return num > 0 && num <= 10000000;
    }, 'Amount must be between 0 and 10,000,000')
    .refine(val => {
      const num = parseFloat(val);
      return !isNaN(num);
    }, 'Invalid amount format'),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid token address'),
});
