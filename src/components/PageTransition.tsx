import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { isEmbeddedWebview, isFarcasterContext } from '@/config/wagmi';

interface PageTransitionProps {
  children: ReactNode;
}

// Inside Farcaster / Base App webviews animation frames can be throttled while
// the host is still compositing. A page that starts at `opacity: 0` then never
// receives its animation frame reads as a black/blank screen, so we render the
// content statically there.
const STATIC_RENDER =
  typeof window !== 'undefined' && (isEmbeddedWebview() || isFarcasterContext());

const PageTransition = ({ children }: PageTransitionProps) => {
  if (STATIC_RENDER) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
