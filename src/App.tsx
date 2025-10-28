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
import PitchDeck from "./pages/pitch-deck/PitchDeck";
import GuidePage from "./pages/GuidePage";
import NotFound from "./pages/NotFound";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { migrateAllData } from "./lib/migrateLocalStorageData";
import { AuthProvider } from "./contexts/AuthContext";
import { sdk } from "@farcaster/miniapp-sdk";
import frameSdk from '@farcaster/frame-sdk';

// Detect if running inside Farcaster using multiple methods
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check if running in iframe (Farcaster miniapps run in iframe)
    const inIframe = window.self !== window.top;
    
    // Check 1: Running in iframe with Farcaster SDK
    if (inIframe && (frameSdk?.context || sdk?.context)) {
      console.log('[Farcaster Detection] Detected via iframe + SDK context');
      return true;
    }
    
    // Check 2: URL contains farcaster
    const url = window.location.href;
    if (url.includes('warpcast.com') || url.includes('farcaster://')) {
      console.log('[Farcaster Detection] Detected via URL');
      return true;
    }
    
    // Check 3: User agent contains Farcaster
    if (navigator.userAgent.includes('Farcaster')) {
      console.log('[Farcaster Detection] Detected via User Agent');
      return true;
    }
    
    console.log('[Farcaster Detection] Not detected. inIframe:', inIframe, 'SDK context:', !!frameSdk?.context);
    return false;
  } catch (error) {
    console.error('[Farcaster Detection] Error:', error);
    return false;
  }
};

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  // Initialize Farcaster Mini App SDK
  useEffect(() => {
    sdk.actions.ready().catch((error) => {
      console.error('Failed to initialize Farcaster SDK:', error);
    });
  }, []);

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
        <Route path="/pitch" element={<PitchDeck />} />
        <Route path="/guide" element={<GuidePage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => {
  const [isFarcaster, setIsFarcaster] = useState(isFarcasterContext());
  
  // Recheck after SDK initialization
  useEffect(() => {
    const checkContext = () => {
      const inFarcaster = isFarcasterContext();
      if (inFarcaster !== isFarcaster) {
        setIsFarcaster(inFarcaster);
      }
    };
    
    // Check immediately and after a short delay for SDK initialization
    checkContext();
    const timer = setTimeout(checkContext, 500);
    return () => clearTimeout(timer);
  }, []);

  const content = (
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {isFarcaster ? (
          content
        ) : (
          <RainbowKitProvider 
            locale={rainbowKitLocale}
            modalSize="compact"
            appInfo={{
              appName: 'Loyal Spark',
              learnMoreUrl: 'https://loyalspark.online',
            }}
          >
            {content}
          </RainbowKitProvider>
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;
