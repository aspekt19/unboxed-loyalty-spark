import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { PrivyProvider } from "@privy-io/react-auth";
import { isFarcasterContext, farcasterWagmiConfig, privyWagmiConfig } from "./config/wagmi";
import { PRIVY_APP_ID, privyConfig } from "./config/privy";
import Index from "./pages/Index";
import AppPage from "./pages/AppPage";
import CustomerPage from "./pages/CustomerPage";
import MerchantPage from "./pages/MerchantPage";
import AdminPage from "./pages/AdminPage";
import PitchDeck from "./pages/PitchDeck";
import GuidePage from "./pages/GuidePage";
import InstallPage from "./pages/InstallPage";
import PremiumPage from "./pages/PremiumPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import ForAgentsPage from "./pages/ForAgentsPage";
import NotFound from "./pages/NotFound";
import NativeShopperPage from "./pages/NativeShopperPage";
import NativeBusinessPage from "./pages/NativeBusinessPage";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { migrateAllData } from "./lib/migrateLocalStorageData";
import { usePageMeta } from "./hooks/usePageMeta";
import { AuthProvider } from "./contexts/AuthContext";
import { ConnectorRecoveryListener } from "./components/ConnectorRecoveryListener";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  // Dynamic canonical + meta per route
  usePageMeta();

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
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/app" element={<AppPage />} />
        <Route path="/customer" element={<CustomerPage />} />
        <Route path="/merchant" element={<MerchantPage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pitch" element={<PitchDeck />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="/api-docs" element={<ApiDocsPage />} />
        <Route path="/for-agents" element={<ForAgentsPage />} />
        {/* Native app entry points (Capacitor) */}
        <Route path="/native/shopper" element={<NativeShopperPage />} />
        <Route path="/native/business" element={<NativeBusinessPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

/** Farcaster context: standard WagmiProvider (SIWE only) */
function FarcasterProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={farcasterWagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
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

const isFarcaster = isFarcasterContext();

const App = () => {
  const Providers = isFarcaster ? FarcasterProviders : BrowserProviders;

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
