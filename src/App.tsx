import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { PrivyProvider } from "@privy-io/react-auth";
import { browserPreviewWagmiConfig, detectFarcasterMiniApp, isFarcasterContext, farcasterWagmiConfig, privyWagmiConfig } from "./config/wagmi";
import { PRIVY_APP_ID, privyConfig } from "./config/privy";
import Index from "./pages/Index";
import AppPage from "./pages/AppPage";
import CustomerPage from "./pages/CustomerPage";
import MerchantPage from "./pages/MerchantPage";
import ProgramPage from "./pages/ProgramPage";
import AdminPage from "./pages/AdminPage";
import PitchDeck from "./pages/PitchDeck";
import GuidePage from "./pages/GuidePage";
import InstallPage from "./pages/InstallPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import ForAgentsPage from "./pages/ForAgentsPage";
import ExamplesPage from "./pages/ExamplesPage";
import PricingPage from "./pages/PricingPage";
import TermsPage from "./pages/legal/TermsPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import RefundPage from "./pages/legal/RefundPage";
import TrustPage from "./pages/legal/TrustPage";
import NotFound from "./pages/NotFound";
import NativeShopperPage from "./pages/NativeShopperPage";
import NativeBusinessPage from "./pages/NativeBusinessPage";
import Preview3D from "./pages/Preview3D";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { migrateAllData } from "./lib/migrateLocalStorageData";
import { PageMeta } from "./components/PageMeta";
import { AuthProvider } from "./contexts/AuthContext";
import { ConnectorRecoveryListener } from "./components/ConnectorRecoveryListener";
import { FarcasterAutoConnect } from "./components/FarcasterAutoConnect";
import { ThemeProvider } from "next-themes";
import { useBanStatus } from "./hooks/useBanStatus";
import { BannedScreen } from "./components/BannedScreen";
import { PrivyAvailableContext } from "./hooks/usePrivySafe";
import { AppErrorBoundary } from "./components/AppErrorBoundary";


/**
 * Ban check = UX layer only. Real enforcement lives in the database (RLS +
 * `is_current_user_banned()`), so a banned user cannot read or write anything
 * even if the UI renders. That means we never need to block first paint on it:
 * the app renders instantly and the ban screen replaces it the moment the
 * background check confirms a ban.
 *
 * A previously confirmed ban is remembered in localStorage so a banned user
 * still sees the ban screen immediately on reload (no flash of app UI).
 */
const BAN_CACHE_KEY = 'ls_ban_state';

function readCachedBan(): boolean {
  try {
    return localStorage.getItem(BAN_CACHE_KEY) === '1';
  } catch {
    return false;
  }
}

function BanGate({ children }: { children: React.ReactNode }) {
  const { isBanned, reason, bannedAt, isLoading } = useBanStatus();
  const location = useLocation();
  const [cachedBan, setCachedBan] = useState(readCachedBan);

  useEffect(() => {
    if (isLoading) return;
    try {
      if (isBanned) localStorage.setItem(BAN_CACHE_KEY, '1');
      else localStorage.removeItem(BAN_CACHE_KEY);
    } catch {
      /* storage unavailable — ignore */
    }
    setCachedBan(isBanned);
  }, [isBanned, isLoading]);

  const blocked = isBanned || (isLoading && cachedBan);
  if (blocked && location.pathname !== '/admin') {
    return <BannedScreen reason={reason} bannedAt={bannedAt} />;
  }
  return <>{children}</>;
}



const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();


  // Scroll to top on route change; if URL has a hash, scroll to that element.
  // Without this, hash links (e.g. /pricing#plans) don't scroll on mobile.
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      // Defer to allow target page to mount
      const t = window.setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
      }, 60);
      return () => window.clearTimeout(t);
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.hash]);

  // Автоматическая миграция данных из localStorage в БД при каждой загрузке
  useEffect(() => {
    const migrationKey = 'data_migrated_to_cloud';
    const lastMigrationTime = localStorage.getItem(migrationKey);
    const now = Date.now();
    
    const hasRewards = localStorage.getItem('merchantRewards');
    const hasVouchers = localStorage.getItem('customerVouchers');
    
    const shouldMigrate = !lastMigrationTime || 
      ((now - parseInt(lastMigrationTime)) > 3600000 && (hasRewards || hasVouchers));
    
    if (shouldMigrate) {
      migrateAllData().then(() => {
        localStorage.setItem(migrationKey, now.toString());
      });
    }
  }, []);

  return (
    <BanGate>
      <PageMeta />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Index />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/merchant" element={<MerchantPage />} />
          <Route path="/program/:tokenAddress" element={<ProgramPage />} />
          {/* /premium deprecated → redirect to public pricing */}
          <Route path="/premium" element={<Navigate to="/pricing" replace />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/pitch" element={<PitchDeck />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/for-agents" element={<ForAgentsPage />} />
          <Route path="/examples" element={<ExamplesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/legal/refund" element={<RefundPage />} />
          <Route path="/trust" element={<TrustPage />} />
          {/* Native app entry points (Capacitor) */}
          <Route path="/native/shopper" element={<NativeShopperPage />} />
          <Route path="/native/business" element={<NativeBusinessPage />} />
          <Route path="/preview-3d" element={<Preview3D />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    </BanGate>
  );
}

/** Farcaster context: standard WagmiProvider (SIWE only) — no Privy in tree. */
function FarcasterProviders({ children }: { children: React.ReactNode }) {
  return (
    <PrivyAvailableContext.Provider value={false}>
      <WagmiProvider config={farcasterWagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <FarcasterAutoConnect />
              <Toaster />
              <Sonner />
              {children}
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyAvailableContext.Provider>
  );
}

/** Regular browser: Privy + wagmi (email/phone/Google + embedded wallets, then SIWE) */
function BrowserProviders({ children }: { children: React.ReactNode }) {
  return (
    <PrivyAvailableContext.Provider value={true}>
      <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig}>
            <AuthProvider>
              <TooltipProvider>
                <ConnectorRecoveryListener />
                <Toaster />
                <Sonner />
                {children}
              </TooltipProvider>
            </AuthProvider>
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </PrivyAvailableContext.Provider>
  );
}

function PreviewBrowserProviders({ children }: { children: React.ReactNode }) {
  return (
    <PrivyAvailableContext.Provider value={false}>
      <WagmiProvider config={browserPreviewWagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <ConnectorRecoveryListener />
              <Toaster />
              <Sonner />
              {children}
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyAvailableContext.Provider>
  );
}

const isLovablePreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.endsWith(".lovableproject.com") ||
    window.location.hostname.startsWith("id-preview--"));

const App = () => {
  const [isFarcaster, setIsFarcaster] = useState<boolean | null>(() => {
    if (isLovablePreviewHost) return false;
    return isFarcasterContext() ? true : null;
  });

  useEffect(() => {
    if (isLovablePreviewHost || isFarcaster !== null) return;

    let cancelled = false;

    // Hard safety net: if the miniapp SDK import or detection ever hangs
    // (flaky webview network on first launch in Base App), never leave the
    // user on a blank screen — fall back to the regular browser providers.
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) setIsFarcaster(false);
    }, 1500);

    void detectFarcasterMiniApp()
      .catch(() => false)
      .then((result) => {
        if (!cancelled) {
          setIsFarcaster(result);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [isFarcaster]);

  if (isFarcaster === null) {
    return <div className="min-h-screen bg-background" />;
  }

  const Providers = isFarcaster
    ? FarcasterProviders
    : isLovablePreviewHost
      ? PreviewBrowserProviders
      : BrowserProviders;

  return (
    <AppErrorBoundary scope="root">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="loyal-spark-theme">
        <Providers>
          <BrowserRouter>
            <AppErrorBoundary scope="routes">
              <AnimatedRoutes />
            </AppErrorBoundary>
          </BrowserRouter>
        </Providers>
      </ThemeProvider>
    </AppErrorBoundary>
  );
};

export default App;

