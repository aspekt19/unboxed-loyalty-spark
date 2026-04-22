import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { PrivyProvider } from "@privy-io/react-auth";
import { browserPreviewWagmiConfig, isFarcasterContext, farcasterWagmiConfig, privyWagmiConfig } from "./config/wagmi";
import { PRIVY_APP_ID, privyConfig } from "./config/privy";
import Index from "./pages/Index";
import AppPage from "./pages/AppPage";
import CustomerPage from "./pages/CustomerPage";
import MerchantPage from "./pages/MerchantPage";
import AdminPage from "./pages/AdminPage";
import PitchDeck from "./pages/PitchDeck";
import GuidePage from "./pages/GuidePage";
import InstallPage from "./pages/InstallPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import ForAgentsPage from "./pages/ForAgentsPage";
import PricingPage from "./pages/PricingPage";
import TermsPage from "./pages/legal/TermsPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import RefundPage from "./pages/legal/RefundPage";
import NotFound from "./pages/NotFound";
import NativeShopperPage from "./pages/NativeShopperPage";
import NativeBusinessPage from "./pages/NativeBusinessPage";
import Preview3D from "./pages/Preview3D";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { migrateAllData } from "./lib/migrateLocalStorageData";
import { usePageMeta } from "./hooks/usePageMeta";
import { AuthProvider } from "./contexts/AuthContext";
import { ActiveWalletProvider } from "./contexts/ActiveWalletContext";
import { ConnectorRecoveryListener } from "./components/ConnectorRecoveryListener";
import { FarcasterAutoConnect } from "./components/FarcasterAutoConnect";
import { ThemeProvider } from "next-themes";
import { useBanStatus } from "./hooks/useBanStatus";
import { BannedScreen } from "./components/BannedScreen";

function BanGate({ children }: { children: React.ReactNode }) {
  const { isBanned, reason, bannedAt, isLoading } = useBanStatus();
  const location = useLocation();
  // Allow admin route through (admins can't be banned anyway, but failsafe)
  if (isLoading) return <>{children}</>;
  if (isBanned && location.pathname !== '/admin') {
    return <BannedScreen reason={reason} bannedAt={bannedAt} />;
  }
  return <>{children}</>;
}

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  // Dynamic canonical + meta per route
  usePageMeta();

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
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Index />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/merchant" element={<MerchantPage />} />
          {/* /premium deprecated → redirect to public pricing */}
          <Route path="/premium" element={<Navigate to="/pricing" replace />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/pitch" element={<PitchDeck />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/for-agents" element={<ForAgentsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/legal/refund" element={<RefundPage />} />
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

/** Farcaster context: standard WagmiProvider (SIWE only) */
function FarcasterProviders({ children }: { children: React.ReactNode }) {
  return (
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
  );
}

/** Regular browser: Privy + wagmi (email/phone/Google + embedded wallets, then SIWE) */
function BrowserProviders({ children }: { children: React.ReactNode }) {
  return (
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
  );
}

function PreviewBrowserProviders({ children }: { children: React.ReactNode }) {
  return (
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
  );
}

const isFarcaster = isFarcasterContext();
const isLovablePreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.endsWith(".lovableproject.com") ||
    window.location.hostname.startsWith("id-preview--"));

const App = () => {
  const Providers = isFarcaster
    ? FarcasterProviders
    : isLovablePreviewHost
      ? PreviewBrowserProviders
      : BrowserProviders;

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="loyal-spark-theme">
      <Providers>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </Providers>
    </ThemeProvider>
  );
};

export default App;
