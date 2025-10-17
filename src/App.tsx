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
import CustomerPage from "./pages/CustomerPage";
import MerchantPage from "./pages/MerchantPage";
import NotFound from "./pages/NotFound";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { migrateAllData } from "./lib/migrateLocalStorageData";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  // Миграция данных из localStorage в базу данных при первой загрузке
  useEffect(() => {
    const migrationKey = 'data_migrated_to_cloud';
    const alreadyMigrated = localStorage.getItem(migrationKey);
    
    if (!alreadyMigrated) {
      migrateAllData().then(() => {
        localStorage.setItem(migrationKey, 'true');
      });
    }
  }, []);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/customer" element={<CustomerPage />} />
        <Route path="/merchant" element={<MerchantPage />} />
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
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
