import { Button } from '@/components/ui/button';
import { Shield, Zap, Globe, TrendingUp, ArrowRight, Bot, Code } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import FarcasterSplash from '@/components/FarcasterSplash';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdminLink } from '@/components/AdminLink';
import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { motion } from 'framer-motion';
import HowItWorks from '@/components/landing/HowItWorks';
import DualBenefits from '@/components/landing/DualBenefits';
import OnchainSimple from '@/components/landing/OnchainSimple';
import PaymentHandshake from '@/components/landing/PaymentHandshake';
import TrustSecurity from '@/components/landing/TrustSecurity';
import UseCases from '@/components/landing/UseCases';
import LandingHero from '@/components/landing/LandingHero';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingAgents from '@/components/landing/LandingAgents';

import LandingCTA from '@/components/landing/LandingCTA';

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Loyal Spark",
      "url": "https://loyalspark.online",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": "Loyalty tokens that earn, invest and multiply onchain. Get rewarded for purchases, save automatically, and grow your rewards in DeFi.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "Loyal Spark",
        "url": "https://loyalspark.online",
        "sameAs": ["https://x.com/Loyal_Spark"]
      }
    },
    {
      "@type": "WebAPI",
      "name": "Loyal Spark API",
      "url": "https://loyalspark.online/api-docs",
      "documentation": "https://loyalspark.online/openapi.json",
      "description": "REST API and MCP Server for AI agents to create loyalty programs, mint tokens, and manage rewards on BASE network."
    },
    {
      "@type": "WebSite",
      "name": "Loyal Spark",
      "url": "https://loyalspark.online"
    }
  ]
};

const Index = () => {
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [checkedFarcaster, setCheckedFarcaster] = useState(false);

  useEffect(() => {
    const checkFarcasterContext = async () => {
      if (typeof window !== 'undefined') {
        try {
          const context = await sdk.context;
          const inFarcaster = !!context?.client?.clientFid;
          setIsFarcaster(inFarcaster);
          if (inFarcaster) {
            // Auto-redirect into the app — wallet connect + SIWE happens there.
            window.location.replace('/app');
            return;
          }
        } catch {
          setIsFarcaster(false);
        }
      }
      setCheckedFarcaster(true);
    };
    checkFarcasterContext();
  }, []);

  if (isFarcaster) {
    // While the redirect is in flight, show the Farcaster splash so the
    // miniapp host gets `sdk.actions.ready()` from FarcasterSplash.
    return <FarcasterSplash onLaunch={() => window.location.replace('/app')} />;
  }

  if (!checkedFarcaster) return null;

  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-gradient-hero">
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-smooth">
          <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg transition-smooth group-hover:scale-110 group-hover:rotate-6" 
              />
              <span className="text-base sm:text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
            <div className="flex items-center gap-2">
              <AdminLink />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 relative overflow-hidden">
          {/* Hero */}
          <LandingHero />

          {/* 1. How it works — user-facing, simple */}
          <HowItWorks />

          {/* 2. For customers / For businesses */}
          <DualBenefits />

          {/* 3. Onchain, but simple */}
          <OnchainSimple />

          {/* 4. Why Loyal Spark — feature grid */}
          <LandingFeatures />


          {/* 6. AI Agents Section — for developers/advanced users */}
          <LandingAgents />

          {/* 7. Machine Payments */}
          <PaymentHandshake />

          {/* 8. Trust & Security */}
          <TrustSecurity />

          {/* 9. Use Cases */}
          <UseCases />

          {/* 10. Final CTA */}
          <LandingCTA />
        </main>

        <footer className="border-t border-border/50 py-6 sm:py-8 mt-12 sm:mt-16 bg-background/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <p className="text-center md:text-left font-medium">© 2025 Loyal Spark. Built on BASE Network.</p>
              <div className="flex items-center gap-4 sm:gap-6 text-center">
                <a 
                  href="mailto:admin@loyalspark.online" 
                  className="hover:text-primary transition-smooth truncate font-medium"
                >
                  admin@loyalspark.online
                </a>
                <span className="text-border">|</span>
                <a 
                  href="https://x.com/Loyal_Spark" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-smooth font-medium"
                >
                  Twitter/X
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
};

export default Index;
