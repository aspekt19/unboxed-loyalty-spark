import { WALLET_CONNECTOR_ERROR_EVENT } from '@/constants/walletConnectorRecovery';

/** Full text for matching (message + cause), same idea as main.tsx unhandledrejection. */
export function walletConnectorFailureText(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causePart =
      typeof cause === 'string'
        ? cause
        : cause instanceof Error
          ? cause.message
          : '';
    return [error.message, causePart].filter(Boolean).join(' ');
  }
  try {
    return String(error);
  } catch {
    return '';
  }
}

export function isWalletConnectorFailureMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('connector error') ||
    m.includes('unknown connector') ||
    m.includes('unknown rpc') ||
    m.includes('connector not found')
  );
}

export function dispatchWalletConnectorRecovery(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WALLET_CONNECTOR_ERROR_EVENT));
}
