import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.14 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.62l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export function MethodRow({
  icon,
  title,
  detail,
  onClick,
  disabled,
  tone = 'card',
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'card' | 'quiet';
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={`h-auto min-h-[3.75rem] w-full justify-start gap-3 rounded-2xl px-3.5 py-2.5 text-left whitespace-normal ${tone === 'quiet' ? 'border-dashed bg-muted/40 shadow-none' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background shadow-clay-sm">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground">{detail}</span>
      </span>
    </Button>
  );
}
