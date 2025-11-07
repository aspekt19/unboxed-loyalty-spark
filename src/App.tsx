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
import NotFound from "./pages/NotFound";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { migrateAllData } from "./lib/migrateLocalStorageData";
import { AuthProvider } from "./contexts/AuthContext";
import { sdk } from "@farcaster/miniapp-sdk";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

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
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
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
);

export default App;
