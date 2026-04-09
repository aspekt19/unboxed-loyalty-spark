import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config, rainbowKitLocale } from "./config/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import Index from "./pages/Index";
import AppPage from "./pages/AppPage";
import CustomerPage from "./pages/CustomerPage";
import MerchantPage from "./pages/MerchantPage";
import AdminPage from "./pages/AdminPage";
import PitchDeck from "./pages/pitch-deck/PitchDeck";
import GuidePage from "./pages/GuidePage";
import InstallPage from "./pages/InstallPage";
import PremiumPage from "./pages/PremiumPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import NotFound from "./pages/NotFound";
import NativeShopperPage from "./pages/NativeShopperPage";
import NativeBusinessPage from "./pages/NativeBusinessPage";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { migrateAllData } from "./lib/migrateLocalStorageData";
import { usePageMeta } from "./hooks/usePageMeta";
import { AuthProvider } from "./contexts/AuthContext";
import { sdk } from "@farcaster/miniapp-sdk";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  // Dynamic canonical + meta per route
  usePageMeta();

  // SDK ready is called in FarcasterSplash component when content is loaded

  // Автоматическая миграция данных из localStorage в БД при каждой загрузке
  // (если есть данные для миграции)
  useEffect(() => {
    const migrationKey = 'data_migrated_to_cloud';
    const lastMigrationTime = localStorage.getItem(migrationKey);
    const now = Date.now();
    
    // Проверяем, есть ли данные в localStorage для миграции
    const hasRewards = localStorage.getItem('merchantRewards');
    const hasVouchers = localStorage.getItem('customerVouchers');
    
    // Мигрируем если:
    // 1. Никогда не мигрировали ИЛИ
    // 2. Прошло более 1 часа с последней миграции И есть данные для миграции
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
        {/* Native app entry points (Capacitor) */}
        <Route path="/native/shopper" element={<NativeShopperPage />} />
        <Route path="/native/business" element={<NativeBusinessPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="loyal-spark-theme">
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider locale={rainbowKitLocale}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AnimatedRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ThemeProvider>
);

export default App;
