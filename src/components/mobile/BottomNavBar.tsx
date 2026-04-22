import { Gift, Store, User, Compass } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const defaultNavItems: NavItem[] = [
  { id: 'loyalty', label: 'Loyalty', icon: Gift },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'marketplace', label: 'Exchange', icon: Store },
  { id: 'profile', label: 'Profile', icon: User },
];

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showProfileNav?: boolean;
  navItems?: NavItem[];
}

export function BottomNavBar({ activeTab, onTabChange, showProfileNav = true, navItems }: BottomNavBarProps) {
  const base = navItems || defaultNavItems;
  const items = showProfileNav ? base : base.filter((i) => i.id !== 'profile');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      <div className="bg-background/95 backdrop-blur-xl border-t border-border/60 px-2 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="flex items-center justify-around py-1.5">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[64px]',
                  'active:scale-[0.96] transition-transform duration-100',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute inset-0 bg-primary/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className={cn(
                  'h-5 w-5 relative z-10 transition-all duration-200',
                  isActive && 'scale-110'
                )} />
                <span className={cn(
                  'text-[10px] font-medium relative z-10 transition-all duration-200',
                  isActive && 'font-semibold'
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
