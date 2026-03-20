import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const isMobile = useIsMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);
  const opacity = useTransform(pullDistance, [0, 60], [0, 1]);
  const rotate = useTransform(pullDistance, [0, 80], [0, 360]);
  const scale = useTransform(pullDistance, [0, 60], [0.5, 1]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;
    // Only activate if scrolled to top
    if (containerRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current || isRefreshing) return;
    if (containerRef.current.scrollTop > 0) return;
    
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, (currentY - startY.current) * 0.4);
    
    if (diff > 0) {
      pullDistance.set(Math.min(diff, 100));
    }
  }, [isRefreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    const currentPull = pullDistance.get();
    if (currentPull > 60 && !isRefreshing) {
      setIsRefreshing(true);
      pullDistance.set(50);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        pullDistance.set(0);
      }
    } else {
      pullDistance.set(0);
    }
  }, [isRefreshing, onRefresh, pullDistance]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      <motion.div
        className="flex items-center justify-center py-2 overflow-hidden"
        style={{ height: pullDistance }}
      >
        <motion.div style={{ opacity, scale }}>
          <motion.div style={{ rotate }}>
            <RefreshCw className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.div>
        </motion.div>
      </motion.div>
      {children}
    </div>
  );
}
