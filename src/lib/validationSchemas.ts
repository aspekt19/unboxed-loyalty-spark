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
