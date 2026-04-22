import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Gift, ShoppingCart, TrendingUp, Wand2, Zap, Coins, Wallet } from 'lucide-react';

/**
 * Preview-only page exploring a 3D "claymorphism" aesthetic
 * inspired by the user's mood-board screenshot.
 * Uses ONLY existing design tokens (primary=purple, secondary=orange,
 * accent=lavender) — no new colors introduced.
 */
const Preview3D = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted py-12 px-4">
      {/* Floating ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl"
          animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 -right-20 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], x: [0, -30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Preview banner */}
        <div className="mb-8 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm">
            <Wand2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">3D Claymorphism Preview</span>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Back to current landing
          </Link>
        </div>

        {/* === MAIN CLAY CARD (mimicking the screenshot frame) === */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[2.5rem] p-6 sm:p-10 md:p-14 relative"
          style={{
            background: 'linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
            boxShadow:
              '20px 20px 60px hsl(var(--primary) / 0.15), -20px -20px 60px hsl(0 0% 100% / 0.8), inset 2px 2px 6px hsl(0 0% 100% / 0.6), inset -2px -2px 6px hsl(var(--primary) / 0.05)',
          }}
        >
          {/* Top nav pills */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
            <div className="flex items-center gap-3">
              <ClayPill className="bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </ClayPill>
              <span className="font-bold text-lg" style={{ fontFamily: 'cursive' }}>
                Loyal Spark
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <NavPill>Dashboard</NavPill>
              <NavPill>Rewards</NavPill>
              <NavPill>Earn</NavPill>
              <NavPill variant="secondary">Invest</NavPill>
              <NavPill variant="primary">Connect</NavPill>
            </div>
          </div>

          {/* Hero clay card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-[2rem] p-8 sm:p-10 md:p-12 mb-10 relative overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)',
              boxShadow:
                '12px 12px 30px hsl(var(--primary) / 0.12), -12px -12px 30px hsl(0 0% 100% / 0.7), inset 1px 1px 3px hsl(0 0% 100% / 0.5)',
            }}
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3 bg-clip-text text-transparent bg-gradient-to-br from-secondary via-primary to-primary">
                  Unlock Exclusive Rewards with Crypto
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">
                  Your loyalty, powered by blockchain. Earn tokens at your favorite stores, watch them grow.
                </p>
                <ClayButton variant="secondary">Join Now</ClayButton>
              </div>

              {/* 3D lightning illustration */}
              <div className="relative h-64 flex items-center justify-center">
                <ClayCoin className="absolute top-4 left-8 h-14 w-14 bg-secondary/30" delay={0}>
                  <Coins className="h-6 w-6 text-secondary" />
                </ClayCoin>
                <ClayCoin className="absolute bottom-6 left-4 h-12 w-12 bg-primary/30" delay={0.5}>
                  <Coins className="h-5 w-5 text-primary" />
                </ClayCoin>
                <ClayCoin className="absolute top-8 right-6 h-10 w-10 bg-accent/40" delay={1}>
                  <Coins className="h-4 w-4 text-accent-foreground" />
                </ClayCoin>
                <ClayCoin className="absolute bottom-4 right-12 h-16 w-16 bg-secondary/30" delay={1.5}>
                  <Coins className="h-7 w-7 text-secondary" />
                </ClayCoin>

                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [0, 3, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative z-10"
                >
                  <div
                    className="h-32 w-32 rounded-3xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(145deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 100%)',
                      boxShadow:
                        '8px 8px 20px hsl(var(--primary) / 0.4), -4px -4px 12px hsl(0 0% 100% / 0.3), inset 2px 2px 4px hsl(0 0% 100% / 0.4)',
                    }}
                  >
                    <Zap className="h-16 w-16 text-white drop-shadow-lg" fill="currentColor" />
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* === 3D feature blocks (the part the user loved) === */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            <ClayFeatureBlock
              icon={Gift}
              title="Accumulate tokens effortlessly"
              tint="primary"
              delay={0.3}
            />
            <ClayFeatureBlock
              icon={ShoppingCart}
              title="Claim exclusive products & experiences"
              tint="accent"
              delay={0.45}
            />
            <ClayFeatureBlock
              icon={TrendingUp}
              title="Increase your crypto holdings"
              tint="secondary"
              delay={0.6}
            />
          </div>

          {/* Footer support pill */}
          <div className="mt-10 flex items-center justify-between">
            <ClayPill className="bg-card gap-2 px-4">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Support</span>
            </ClayPill>
            <span className="text-xs text-muted-foreground">Built on Base • Powered by Loyal Spark</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* ============================================================
   Reusable clay primitives — all driven by design tokens
   ============================================================ */

const ClayPill = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`inline-flex items-center justify-center h-10 px-3 rounded-full ${className}`}
    style={{
      boxShadow:
        '4px 4px 10px hsl(var(--primary) / 0.12), -3px -3px 8px hsl(0 0% 100% / 0.7), inset 1px 1px 2px hsl(0 0% 100% / 0.5)',
    }}
  >
    {children}
  </div>
);

const NavPill = ({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
}) => {
  const bg =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground'
      : variant === 'secondary'
      ? 'bg-secondary text-secondary-foreground'
      : 'bg-card text-foreground';
  const shadow =
    variant === 'primary'
      ? '6px 6px 14px hsl(var(--primary) / 0.35), -3px -3px 8px hsl(0 0% 100% / 0.6), inset 1px 1px 2px hsl(0 0% 100% / 0.4)'
      : variant === 'secondary'
      ? '6px 6px 14px hsl(var(--secondary) / 0.35), -3px -3px 8px hsl(0 0% 100% / 0.6), inset 1px 1px 2px hsl(0 0% 100% / 0.4)'
      : '4px 4px 10px hsl(var(--primary) / 0.10), -3px -3px 8px hsl(0 0% 100% / 0.7), inset 1px 1px 2px hsl(0 0% 100% / 0.5)';

  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold ${bg}`}
      style={{ boxShadow: shadow }}
    >
      {children}
    </motion.button>
  );
};

const ClayButton = ({
  children,
  variant = 'primary',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) => {
  const isSec = variant === 'secondary';
  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.04 }}
      whileTap={{ y: 0, scale: 0.98 }}
      className={`px-7 py-3.5 rounded-2xl text-sm sm:text-base font-bold ${
        isSec ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'
      }`}
      style={{
        boxShadow: isSec
          ? '8px 8px 18px hsl(var(--secondary) / 0.4), -4px -4px 12px hsl(0 0% 100% / 0.5), inset 2px 2px 3px hsl(0 0% 100% / 0.4), inset -2px -2px 3px hsl(var(--secondary) / 0.4)'
          : '8px 8px 18px hsl(var(--primary) / 0.4), -4px -4px 12px hsl(0 0% 100% / 0.5), inset 2px 2px 3px hsl(0 0% 100% / 0.4), inset -2px -2px 3px hsl(var(--primary) / 0.4)',
      }}
    >
      {children}
    </motion.button>
  );
};

const ClayCoin = ({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    animate={{ y: [0, -8, 0] }}
    transition={{ duration: 3 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    className={`rounded-full flex items-center justify-center ${className}`}
    style={{
      boxShadow:
        '4px 4px 10px hsl(var(--primary) / 0.2), -2px -2px 6px hsl(0 0% 100% / 0.6), inset 1px 1px 2px hsl(0 0% 100% / 0.5)',
    }}
  >
    {children}
  </motion.div>
);

const ClayFeatureBlock = ({
  icon: Icon,
  title,
  tint,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tint: 'primary' | 'secondary' | 'accent';
  delay: number;
}) => {
  const bg =
    tint === 'primary'
      ? 'bg-primary'
      : tint === 'secondary'
      ? 'bg-secondary'
      : 'bg-accent';
  const tintVar = tint === 'accent' ? 'primary' : tint;
  const fg =
    tint === 'accent' ? 'text-accent-foreground' : tint === 'primary' ? 'text-primary-foreground' : 'text-secondary-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.03 }}
      className={`${bg} ${fg} rounded-3xl p-7 text-center cursor-pointer`}
      style={{
        boxShadow: `12px 12px 30px hsl(var(--${tintVar}) / 0.35), -6px -6px 20px hsl(0 0% 100% / 0.5), inset 2px 2px 4px hsl(0 0% 100% / 0.35), inset -3px -3px 6px hsl(var(--${tintVar}) / 0.4)`,
      }}
    >
      <div
        className="h-14 w-14 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-white/25 backdrop-blur-sm"
        style={{
          boxShadow: 'inset 2px 2px 4px hsl(0 0% 100% / 0.4), inset -2px -2px 4px hsl(0 0% 0% / 0.1)',
        }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-semibold leading-snug">{title}</p>
    </motion.div>
  );
};

export default Preview3D;
