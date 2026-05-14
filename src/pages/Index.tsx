import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import FarcasterSplash from '@/components/FarcasterSplash';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdminLink } from '@/components/AdminLink';
import { useState, useEffect } from 'react';
import HowItWorks from '@/components/landing/HowItWorks';
import DualBenefits from '@/components/landing/DualBenefits';
import OnchainSimple from '@/components/landing/OnchainSimple';
import PaymentHandshake from '@/components/landing/PaymentHandshake';
import TrustSecurity from '@/components/landing/TrustSecurity';
import UseCases from '@/components/landing/UseCases';
import LandingHero from '@/components/landing/LandingHero';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingAgents from '@/components/landing/LandingAgents';
import LandingNav from '@/components/landing/LandingNav';
import LandingCTA from '@/components/landing/LandingCTA';
import NotifyMe from '@/components/landing/NotifyMe';
import { detectFarcasterMiniApp, isFarcasterContext } from '@/config/wagmi';

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Loyal Spark",
      "url": "https://loyalspark.online",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": "Onchain loyalty protocol on Base. Merchants launch branded ERC-20 reward programs; customers earn, redeem, and trade tokens P2P; AI agents automate it via REST API and MCP.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free tier: 200 API calls/month, 1 agent, 1.25% mint fee"
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

const FARCASTER_CONTEXT_TIMEOUT_MS = 1200;

const Index = () => {
  const [isFarcaster, setIsFarcaster] = useState(() => isFarcasterContext());

  useEffect(() => {
    if (!isFarcasterContext()) {
      setIsFarcaster(false);
      return;
    }

    let cancelled = false;

    const checkFarcasterContext = async () => {
      try {
        const hinted = isFarcasterContext();
        const inFarcaster = hinted || await detectFarcasterMiniApp(FARCASTER_CONTEXT_TIMEOUT_MS);

        if (cancelled) return;
        setIsFarcaster(inFarcaster);

        if (inFarcaster) {
          window.location.replace('/app');
        }
      } catch {
        if (!cancelled) {
          setIsFarcaster(false);
        }
      }
    };

    void checkFarcasterContext();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isFarcaster) {
    return <FarcasterSplash onLaunch={() => window.location.replace('/app')} />;
  }

  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-gradient-hero">
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-smooth">
          <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-between items-center relative">
            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg transition-smooth group-hover:scale-110 group-hover:rotate-6" 
              />
              <span className="text-base sm:text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <LandingNav />
              <div className="hidden sm:flex items-center gap-1">
                <AdminLink />
                <ThemeToggle />
              </div>
              <div className="flex sm:hidden items-center">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 relative overflow-hidden">
          <LandingHero />
          <HowItWorks />
          <DualBenefits />
          <OnchainSimple />
          <LandingFeatures />
          <LandingAgents />
          <PaymentHandshake />
          <TrustSecurity />
          <UseCases />
          <NotifyMe source="landing" />
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
