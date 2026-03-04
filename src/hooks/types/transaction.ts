/**
 * Shared types for blockchain transaction hooks.
 * 
 * Provides consistent interfaces across all token operation hooks
 * (mint, burn, transfer, approve, deploy).
 */

/** Common result shape returned by transaction hooks */
export interface TransactionResult {
  /** Whether a transaction is pending submission or confirmation */
  isPending: boolean;
  /** Whether the transaction was confirmed successfully */
  isSuccess: boolean;
  /** The transaction hash, if submitted */
  hash: `0x${string}` | undefined;
  /** Error from the transaction, if any */
  error: Error | null;
}

/** Extended result for hooks that support reset */
export interface ResettableTransactionResult extends TransactionResult {
  reset: () => void;
}

/** ERC-20 token address (hex string) */
export type TokenAddress = `0x${string}`;

/** Wallet address (hex string) */
export type WalletAddress = `0x${string}`;

/** Standard ERC-20 ABI fragment for balanceOf */
export const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/** Standard ERC-20 ABI fragment for allowance */
export const ERC20_ALLOWANCE_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/** Loyalty token status check ABI fragments */
export const TOKEN_STATUS_ABI = {
  isMintingActive: [
    {
      inputs: [],
      name: 'isMintingActive',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const,
  isUtilityActive: [
    {
      inputs: [],
      name: 'isUtilityActive',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const,
  pauseUtility: [
    {
      inputs: [],
      name: 'pauseUtility',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const,
  unpauseUtility: [
    {
      inputs: [],
      name: 'unpauseUtility',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const,
  enableMinting: [
    {
      inputs: [],
      name: 'enableMinting',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const,
};

/** Log levels for transaction hooks */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 
 * Structured logger for transaction hooks.
 * Only logs errors in production, all levels in development.
 */
export function txLog(hook: string, level: LogLevel, message: string, data?: unknown): void {
  const isDev = import.meta.env.DEV;
  
  if (!isDev && level !== 'error') return;

  const prefix = `[${hook}]`;
  
  switch (level) {
    case 'error':
      console.error(prefix, message, data ?? '');
      break;
    case 'warn':
      console.warn(prefix, message, data ?? '');
      break;
    case 'info':
      console.info(prefix, message, data ?? '');
      break;
    case 'debug':
      console.log(prefix, message, data ?? '');
      break;
  }
}
