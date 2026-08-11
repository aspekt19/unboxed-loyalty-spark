import { memo, useCallback } from 'react';
import { Gift, Store, User, Compass } from 'lucide-react';
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

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}

// Memoized button: avoids re-rendering inactive tabs when activeTab changes.
const NavButton = memo(function NavButton({ item, isActive, onSelect }: NavButtonProps) {
  // pointerdown fires ~100-300ms earlier than click in webviews (Farcaster, Base App).
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Only react to primary input; ignore secondary mouse buttons.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      onSelect(item.id);
    },
    [item.id, onSelect],
  );

  const Icon = item.icon;

  return (
    <button
      onPointerDown={handlePointerDown}
      // Keep onClick as a fallback for assistive tech / keyboard users.
      onClick={(e) => {
        // Prevent double-fire after pointerdown already handled it.
        e.preventDefault();
      }}
      type="button"
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[56px] touch-manipulation select-none',
        'transition-colors duration-100',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute inset-0 bg-primary/10 rounded-xl pointer-events-none"
        />
      )}
      <Icon
        className={cn(
          'h-5 w-5 relative z-10',
          isActive && 'scale-110',
        )}
      />
      <span
        className={cn(
          'text-[10px] font-medium relative z-10',
          isActive && 'font-semibold',
        )}
      >
        {item.label}
      </span>
    </button>
  );
});

export function BottomNavBar({ activeTab, onTabChange, showProfileNav = true, navItems }: BottomNavBarProps) {
  const base = navItems || defaultNavItems;
  const items = showProfileNav ? base : base.filter((i) => i.id !== 'profile');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ contain: 'layout paint', willChange: 'transform' }}
    >
      <div className="bg-background border-t border-border/60 px-2 pb-[calc(env(safe-area-inset-bottom,8px)+12px)]">
        <div className="flex items-center justify-around py-1.5">
          {items.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onSelect={onTabChange}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
