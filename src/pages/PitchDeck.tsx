import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, TrendingUp, Users, DollarSign, Target, Zap, Shield, Globe, Wallet, Store, ShoppingBag, LineChart, Lock, Coins, BarChart3, Bot, UserPlus, Cpu, Code2, KeyRound, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

const pitchJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://loyalspark.online/" },
    { "@type": "ListItem", "position": 2, "name": "Pitch Deck", "item": "https://loyalspark.online/pitch" }
  ]
};

const PitchDeck = () => {
  const slides = [
    {
      id: 'cover',
      title: 'Loyal Spark',
      subtitle: 'Onchain loyalty rewards for SMBs — operated by humans and AI agents',
      tagline: 'Programs you own. Tokens customers truly hold. APIs agents can pay for.',
      icon: Coins,
    },
    {
      id: 'problem',
      title: 'Problem',
      items: [
        { text: 'Legacy loyalty SaaS charges $99–499/mo or 15–30% revenue cuts', icon: DollarSign },
        { text: 'Customers don\'t own points — they can be devalued or expire', icon: Lock },
        { text: 'Programs are siloed and closed to AI agents and automation', icon: Bot },
      ],
    },
    {
      id: 'solution',
      title: 'Solution',
      subtitle: 'A dual-mode loyalty platform for humans (portal) and AI agents (API + MCP):',
      solutionColumns: [
        {
          title: 'OWN',
          subtitle: 'YOUR PROGRAM',
          description: 'Deploy ERC-20 loyalty token on Base. Mint, transfer, redeem onchain.',
          icon: Coins,
        },
        {
          title: 'PAY',
          subtitle: 'PER USE',
          description: 'Predictable USDC SaaS plans. No revenue cut. No hidden lock-in.',
          icon: DollarSign,
        },
        {
          title: 'AUTOMATE',
          subtitle: 'WITH AGENTS',
          description: 'AI agents run programs via REST + MCP, paying with x402 / MPP micropayments.',
          icon: Bot,
        },
      ],
    },
    {
      id: 'validation',
      title: 'Market Validation',
      stats: [
        { value: '630,000+', label: 'SMBs running loyalty programs in the US alone' },
        { value: '$100B+', label: 'Loyalty rewards issued and never redeemed each year' },
      ],
    },
    {
      id: 'market-size',
      title: 'Market Size',
      subtitle: 'Loyalty SaaS + AI-agent commerce',
      marketData: {
        tam: { value: '$200B+', label: 'Total Addressable Market', description: 'Global loyalty rewards (SaaS + points liability)' },
        sam: { value: '$60B', label: 'Serviceable Addressable Market', description: 'SMB & mid-market digital loyalty' },
        share: { value: 'Pre-revenue', label: 'Stage', description: 'Live MVP on Base, onboarding first design partners' },
      },
    },
    {
      id: 'product',
      title: 'Product',
      subtitle: 'Two portals + one programmable API',
      productFlow: {
        merchant: [
          { step: 'Deploy Program', description: 'Create ERC-20 loyalty token on Base in minutes', icon: Coins },
          { step: 'Run Loyalty', description: 'Mint by email/phone/wallet, vouchers, tiers, RFM, automation', icon: BarChart3 },
          { step: 'Invite Team & Agents', description: 'Branches, employees, AI agents with scoped API keys', icon: UserPlus },
        ],
        customer: [
          { step: 'Receive Tokens', description: 'Get loyalty tokens to a smart wallet (Privy / SIWE)', icon: ShoppingBag },
          { step: 'Redeem & Trade', description: 'Spend on rewards or swap P2P via onchain escrow', icon: LineChart },
          { step: 'Truly Own', description: 'Tokens live in the customer\'s wallet, fully transferable', icon: Wallet },
        ],
      },
    },
    {
      id: 'business-model',
      title: 'Business Model',
      subtitle: 'Two pricing axes — merchants pay for the portal, agents pay for the API',
      pricing: {
        merchant: {
          title: 'Merchant SaaS (USDC on Base)',
          tiers: [
            { name: 'Starter', price: '$39 / mo', detail: 'SMB entry: portal, programs, CRM-light' },
            { name: 'Growth', price: '$79 / mo', detail: 'Scale: deeper analytics, more seats' },
            { name: 'Scale', price: '$149 / mo', detail: 'Corporate budgets, priority support' },
          ],
        },
        agents: {
          title: 'AI Agents (API + MCP)',
          tiers: [
            { name: 'Free', price: '$0', detail: '200 calls/mo · 1 agent · 1.25% mint fee' },
            { name: 'Pro', price: '$49 / mo', detail: '10,000 calls · 5 agents · 0.50% mint fee' },
            { name: 'Enterprise', price: '$129 / mo', detail: 'Unlimited calls & agents · 0.25% mint fee' },
          ],
        },
        ppc: {
          title: 'Pay-per-call (x402 / MPP)',
          detail: 'From ~$0.001 per read, ~$0.005–0.05 per write. USDC on Base, no API key.',
        },
      },
    },
    {
      id: 'adoption',
      title: 'Go-to-Market',
      subtitle: 'Land humans first, then unlock the agent channel',
      adoption: [
        { phase: 'Now (live MVP)', target: 'First design partners', focus: 'Onchain loyalty + dashboard on Base' },
        { phase: 'Q3–Q4 2026', target: '10–25 paying merchants', focus: 'Starter/Growth plans, case studies' },
        { phase: 'Q1–Q2 2027', target: '100+ merchants', focus: 'Agent channel: OpenServ, MCP catalogs, x402' },
        { phase: 'H2 2027', target: '500+ merchants', focus: 'Multi-region SaaS + agent revenue share' },
      ],
    },
    {
      id: 'competition',
      title: 'Competition',
      subtitle: 'Legacy loyalty SaaS vs Loyal Spark',
      competitive: {
        traditional: [
          'Square Loyalty: $45–$105/mo per location',
          'LoyaltyLion / Yotpo: $200–$700+/mo, mid-market focus',
          'Smile.io: revenue-share & per-order fees',
          'Closed APIs, no native AI-agent access',
          'Points are a database row — no true ownership',
        ],
        loyalSpark: [
          'Predictable USDC SaaS from $39/mo',
          'Onchain ERC-20 tokens — customers truly own them',
          'Agent-ready: REST + MCP, x402 / MPP micropayments',
          'SIWE & Privy auth — no passwords, no email leaks',
          'P2P escrow marketplace between programs',
        ],
      },
    },
    {
      id: 'advantages',
      title: 'Competitive Advantages',
      subtitle: 'What makes us defensible',
      advantages: [
        { point: 'Dual-mode platform: humans (portal) + AI agents (API + MCP)', icon: Layers },
        { point: 'Two-bills monetization: merchant SaaS + agent API + mint fee %', icon: DollarSign },
        { point: 'Native HTTP 402 payments via x402 and MPP — no API keys needed', icon: Cpu },
        { point: 'Built on Base: low fees, fast finality, USDC-native', icon: Globe },
        { point: 'Hardened security: RLS, SIWE, scoped lsk_/rwk_ API keys', icon: Shield },
        { point: 'Open standards: OpenAPI, agent.json, MCP catalogs (Glama, Smithery, OpenServ)', icon: Code2 },
      ],
    },
    {
      id: 'traction',
      title: 'Current Status',
      metrics: [
        { label: 'Platform', value: 'Live MVP on Base', icon: Zap },
        { label: 'Surfaces', value: 'Web · PWA · Capacitor', icon: Globe },
        { label: 'Agent API', value: '22 REST + 28 MCP tools', icon: Bot },
        { label: 'Auth', value: 'Privy + SIWE + scoped keys', icon: KeyRound },
      ],
    },
  ];

  return (
      <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pitchJsonLd) }} />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-3 xxs:px-4 py-3 flex flex-wrap justify-between items-center gap-2">
            <Link to="/" className="flex items-center gap-1.5 xxs:gap-2 group">
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-7 w-7 xxs:h-8 xxs:w-8 sm:h-9 sm:w-9 rounded-lg transition-transform duration-300 group-hover:scale-105" 
              />
              <span className="text-base xxs:text-lg sm:text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
            <div className="flex items-center gap-2 xxs:gap-3">
              <Link to="/">
                <Button variant="outline" size="sm" className="text-xs xxs:text-sm px-2 xxs:px-3">
                  Back to Home
                </Button>
              </Link>
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 xxs:px-4 sm:px-6 py-6 sm:py-12">
          <div className="max-w-5xl mx-auto space-y-4 sm:space-y-8">
            {slides.map((slide, index) => (
              <Card key={slide.id} className="border bg-card overflow-hidden">
                <CardContent className="p-4 xxs:p-6 sm:p-8 md:p-12">
                  {/* Cover Slide */}
                  {slide.id === 'cover' && (
                    <div className="text-center space-y-4 sm:space-y-6 py-8 sm:py-16">
                      <img 
                        src="/new-favicon.png" 
                        alt="Loyal Spark" 
                        className="mx-auto h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-2xl mb-4 sm:mb-8" 
                      />
                      <h1 className="text-3xl xxs:text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight px-2">
                        {slide.title}
                      </h1>
                      <p className="text-lg xxs:text-xl sm:text-2xl text-muted-foreground font-medium px-2">
                        {slide.subtitle}
                      </p>
                      <p className="text-sm xxs:text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto italic px-4">
                        {slide.tagline}
                      </p>
                      <div className="pt-4 sm:pt-8 flex flex-col items-center gap-3 sm:gap-4">
                        <div className="inline-flex items-center gap-2 px-3 xxs:px-4 py-1.5 xxs:py-2 rounded-full bg-secondary border border-border">
                          <div className="h-1.5 w-1.5 xxs:h-2 xxs:w-2 rounded-full bg-foreground" />
                          <span className="text-xs xxs:text-sm font-medium text-foreground">Built on Base · USDC-native · Agent-ready</span>
                        </div>
                        <a href="https://loyalspark.online/" target="_blank" rel="noopener noreferrer" className="text-sm xxs:text-base font-medium text-foreground hover:underline">
                          loyalspark.online
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Problem Slide */}
                  {slide.id === 'problem' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {slide.items?.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 rounded-xl bg-secondary/50 border border-border">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-foreground/10 flex items-center justify-center flex-shrink-0">
                              <item.icon className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                            </div>
                            <p className="text-sm xxs:text-base sm:text-lg font-medium text-foreground leading-relaxed pt-1 sm:pt-2">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Solution Slide */}
                  {slide.id === 'solution' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3 sm:mb-4">{slide.title}</h2>
                        <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        {slide.solutionColumns?.map((col, i) => (
                          <div key={i} className="text-center p-6 sm:p-8 rounded-xl bg-foreground text-background">
                            <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-full bg-background/10 flex items-center justify-center mb-4 sm:mb-6">
                              <col.icon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-background" />
                            </div>
                            <div className="text-xl sm:text-2xl font-bold mb-1">{col.title}</div>
                            <div className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">{col.subtitle}</div>
                            <p className="text-xs xxs:text-sm leading-relaxed">{col.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Validation Slide */}
                  {slide.id === 'validation' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                        {slide.stats?.map((stat, i) => (
                          <div key={i} className="text-center p-6 sm:p-8 md:p-12 rounded-xl border-2 border-border bg-secondary/30">
                            <div className="text-3xl xxs:text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-3 sm:mb-4">
                              {stat.value}
                            </div>
                            <div className="text-sm xxs:text-base sm:text-lg font-medium text-muted-foreground">
                              {stat.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Size Slide */}
                  {slide.id === 'market-size' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="space-y-4 sm:space-y-6">
                        {slide.marketData && Object.entries(slide.marketData).map(([key, data]) => (
                          <div key={key} className="p-4 sm:p-6 md:p-8 rounded-xl border border-border bg-secondary/30">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                              <div className="flex-1">
                                <div className="text-sm xxs:text-base sm:text-lg font-semibold text-muted-foreground mb-1 sm:mb-2">
                                  {data.label}
                                </div>
                                <div className="text-xs xxs:text-sm text-muted-foreground">
                                  {data.description}
                                </div>
                              </div>
                              <div className="text-2xl xxs:text-3xl sm:text-5xl font-bold text-foreground whitespace-nowrap">
                                {data.value}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product Slide */}
                  {slide.id === 'product' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                        <div className="p-4 sm:p-6 md:p-8 rounded-xl border border-border bg-card">
                          <h3 className="text-lg xxs:text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">For Merchants</h3>
                          <div className="space-y-3 sm:space-y-4">
                            {slide.productFlow?.merchant.map((step, i) => (
                              <div key={i} className="flex items-start gap-3 sm:gap-4">
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                                  <step.icon className="h-4 w-4 sm:h-5 sm:w-5 text-background" />
                                </div>
                                <div>
                                  <div className="text-sm sm:text-base font-bold text-foreground mb-1">{step.step}</div>
                                  <div className="text-xs sm:text-sm text-muted-foreground">{step.description}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 sm:p-6 md:p-8 rounded-xl border border-border bg-card">
                          <h3 className="text-lg xxs:text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">For Customers</h3>
                          <div className="space-y-3 sm:space-y-4">
                            {slide.productFlow?.customer.map((step, i) => (
                              <div key={i} className="flex items-start gap-3 sm:gap-4">
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                                  <step.icon className="h-4 w-4 sm:h-5 sm:w-5 text-background" />
                                </div>
                                <div>
                                  <div className="text-sm sm:text-base font-bold text-foreground mb-1">{step.step}</div>
                                  <div className="text-xs sm:text-sm text-muted-foreground">{step.description}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Business Model Slide — SaaS pricing (USDC on Base) */}
                  {slide.id === 'business-model' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {/* Merchant SaaS */}
                        <div className="p-4 sm:p-6 md:p-8 rounded-xl border border-border bg-secondary/30">
                          <div className="flex items-center gap-3 mb-4 sm:mb-6">
                            <div className="h-10 w-10 rounded-lg bg-foreground flex items-center justify-center">
                              <Store className="h-5 w-5 text-background" />
                            </div>
                            <h3 className="text-base xxs:text-lg sm:text-xl font-bold text-foreground">{slide.pricing?.merchant.title}</h3>
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            {slide.pricing?.merchant.tiers.map((t, i) => (
                              <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-background border border-border">
                                <div>
                                  <div className="text-sm sm:text-base font-bold text-foreground">{t.name}</div>
                                  <div className="text-xs sm:text-sm text-muted-foreground">{t.detail}</div>
                                </div>
                                <div className="text-sm sm:text-base font-semibold text-foreground whitespace-nowrap">{t.price}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* AI Agents */}
                        <div className="p-4 sm:p-6 md:p-8 rounded-xl bg-foreground text-background">
                          <div className="flex items-center gap-3 mb-4 sm:mb-6">
                            <div className="h-10 w-10 rounded-lg bg-background/10 flex items-center justify-center">
                              <Bot className="h-5 w-5 text-background" />
                            </div>
                            <h3 className="text-base xxs:text-lg sm:text-xl font-bold">{slide.pricing?.agents.title}</h3>
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            {slide.pricing?.agents.tiers.map((t, i) => (
                              <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-background/10 border border-background/20">
                                <div>
                                  <div className="text-sm sm:text-base font-bold">{t.name}</div>
                                  <div className="text-xs sm:text-sm opacity-80">{t.detail}</div>
                                </div>
                                <div className="text-sm sm:text-base font-semibold whitespace-nowrap">{t.price}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Pay-per-call */}
                      <div className="p-4 sm:p-6 rounded-xl border border-border bg-card flex items-start gap-3 sm:gap-4">
                        <div className="h-10 w-10 rounded-lg bg-foreground/10 flex items-center justify-center flex-shrink-0">
                          <Cpu className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                          <div className="text-sm sm:text-base font-bold text-foreground mb-1">{slide.pricing?.ppc.title}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground">{slide.pricing?.ppc.detail}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Adoption Strategy Slide */}
                  {slide.id === 'adoption' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {slide.adoption?.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 sm:gap-6 p-4 sm:p-6 rounded-xl border border-border bg-card">
                            <div className="flex-1">
                              <div className="text-sm xxs:text-base sm:text-xl font-bold text-foreground mb-1 sm:mb-2">
                                {item.phase}
                              </div>
                              <div className="text-xs xxs:text-sm sm:text-base text-muted-foreground">
                                Target: <span className="font-semibold text-foreground">{item.target}</span> · {item.focus}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competition Slide */}
                  {slide.id === 'competition' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                        <div className="p-5 sm:p-6 md:p-8 rounded-xl border border-border bg-secondary/30">
                          <h3 className="text-lg xxs:text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Legacy Loyalty SaaS</h3>
                          <ul className="space-y-2 sm:space-y-3">
                            {slide.competitive?.traditional.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                                <span className="text-xs xxs:text-sm sm:text-base text-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-5 sm:p-6 md:p-8 rounded-xl bg-foreground text-background">
                          <h3 className="text-lg xxs:text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Loyal Spark</h3>
                          <ul className="space-y-2 sm:space-y-3">
                            {slide.competitive?.loyalSpark.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-background mt-2 flex-shrink-0" />
                                <span className="text-xs xxs:text-sm sm:text-base">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Competitive Advantages Slide */}
                  {slide.id === 'advantages' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                        {slide.advantages?.map((adv, i) => (
                          <div key={i} className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 rounded-xl bg-foreground text-background">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-background/10 flex items-center justify-center flex-shrink-0">
                              <adv.icon className="h-4 w-4 sm:h-5 sm:w-5 text-background" />
                            </div>
                            <p className="text-xs xxs:text-sm sm:text-base font-medium leading-relaxed pt-0.5 sm:pt-1">
                              {adv.point}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Status Slide */}
                  {slide.id === 'traction' && (
                    <div className="space-y-4 sm:space-y-8">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-2xl xxs:text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        {slide.metrics?.map((metric, i) => (
                          <div key={i} className="p-6 sm:p-8 rounded-xl border border-border bg-card text-center">
                            <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-foreground flex items-center justify-center mb-3 sm:mb-4">
                              <metric.icon className="h-6 w-6 sm:h-7 sm:w-7 text-background" />
                            </div>
                            <div className="text-xs xxs:text-sm font-medium text-muted-foreground mb-2">
                              {metric.label}
                            </div>
                            <div className="text-base xxs:text-lg font-semibold text-foreground break-words">
                              {metric.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            ))}

            {/* Footer */}
            <Card className="border bg-card">
              <CardContent className="p-6 sm:p-8 md:p-12 text-center space-y-3 sm:space-y-4">
                <h2 className="text-2xl xxs:text-3xl sm:text-4xl font-bold text-foreground">Thank You</h2>
                <p className="text-base xxs:text-lg sm:text-xl text-muted-foreground px-2">
                  Let's build the onchain loyalty layer for humans and AI agents
                </p>
                <div className="pt-2 sm:pt-4">
                  <a 
                    href="https://loyalspark.online/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-base xxs:text-lg font-medium text-foreground hover:underline"
                  >
                    loyalspark.online
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </PageTransition>
  );
};

export default PitchDeck;
