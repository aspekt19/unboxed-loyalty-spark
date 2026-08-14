import { motion } from 'framer-motion';
import { Coffee, Shirt, ShieldCheck, Sparkles } from 'lucide-react';

/**
 * Static presentation mock of the customer wallet surface.
 * Purely visual — no live data, no network calls.
 */
const HeroProductCard = () => {
  return (
    <div className="relative">
      <motion.div
        className="relative rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-large overflow-hidden"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />

        <div className="relative flex items-start justify-between mb-6 sm:mb-8">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total balance
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
              2,450 <span className="text-base font-semibold text-muted-foreground">pts</span>
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>

        <div className="relative space-y-3">
          {[
            { icon: Coffee, name: 'Coffee Bean Co.', meta: 'Earned today', delta: '+12.5', tone: 'secondary' as const },
            { icon: Shirt, name: 'Urban Wear', meta: 'Earned this week', delta: '+4.2', tone: 'primary' as const },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/40 p-3 sm:p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${
                    row.tone === 'secondary' ? 'bg-secondary/15' : 'bg-primary/15'
                  }`}
                >
                  <row.icon
                    className={`h-4 w-4 ${row.tone === 'secondary' ? 'text-secondary' : 'text-primary'}`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{row.meta}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-primary tabular-nums shrink-0">{row.delta}</span>
            </div>
          ))}
        </div>

        <div className="relative mt-6 pt-4 border-t border-border/70 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Network · Base Mainnet
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Onchain
          </span>
        </div>
      </motion.div>

      <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-secondary/25 blur-3xl" />
    </div>
  );
};

export default HeroProductCard;
