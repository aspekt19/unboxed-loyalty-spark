import { Mail } from 'lucide-react';

export function SupportBanner() {
  return (
    <div className="border-t border-border mt-8 pt-4 pb-2 text-center">
      <a
        href="mailto:admin@loyalspark.online"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Mail className="h-3.5 w-3.5" />
        Support: admin@loyalspark.online
      </a>
    </div>
  );
}
