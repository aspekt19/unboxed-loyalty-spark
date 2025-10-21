import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Users, DollarSign, Target, Zap, Shield, Globe, ArrowRight, Wallet, Store, ShoppingBag, LineChart, Lock, Coins, BarChart3, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

const PitchDeck = () => {
  const slides = [
    {
      id: 'cover',
      title: 'Loyal Spark',
      subtitle: 'Blockchain Loyalty Rewards Platform',
      tagline: 'Transforming SMB customer engagement with Web3 technology',
      icon: Sparkles,
    },
    {
      id: 'problem',
      title: 'The Problem',
      subtitle: 'Traditional loyalty programs are broken for SMBs',
      items: [
        { text: '$100B+ in unredeemed rewards annually', icon: DollarSign },
        { text: 'High fees (15-30%) for merchants', icon: TrendingUp },
        { text: 'No ownership or control for customers', icon: Users },
        { text: 'Siloed programs with zero interoperability', icon: Target },
      ],
    },
    {
      id: 'solution',
      title: 'Our Solution',
      subtitle: 'Decentralized loyalty tokens with staking-based revenue model',
      items: [
        { text: 'Merchant staking instead of monthly fees', icon: Lock },
        { text: 'True ownership for customers', icon: Wallet },
        { text: 'Tradeable on any DEX', icon: LineChart },
        { text: 'Deflationary tokenomics with 8% burn', icon: Flame },
      ],
    },
    {
      id: 'market',
      title: 'Market Opportunity',
      subtitle: 'Targeting 50M+ SMB merchants worldwide',
      stats: [
        { value: '$200B+', label: 'Global loyalty market', trend: '+15% CAGR' },
        { value: '50M+', label: 'SMB merchants worldwide', trend: 'Primary target' },
        { value: '$48B', label: 'Unredeemed points value', trend: 'Growing annually' },
        { value: '90%', label: 'Consumers in loyalty programs', trend: '4.5B members' },
      ],
    },
    {
      id: 'product',
      title: 'Product Features',
      subtitle: 'Built for SMB merchants and customers',
      features: [
        {
          title: 'For Merchants',
          icon: Store,
          items: [
            'Deploy custom ERC-20 loyalty tokens',
            'Stake LOYAL tokens for access (refundable)',
            'Create redeemable vouchers',
            'Track token holders in real-time',
            'Earn from conversion fees',
          ],
        },
        {
          title: 'For Customers',
          icon: ShoppingBag,
          items: [
            'View all loyalty tokens in one place',
            'Redeem rewards instantly',
            'Trade tokens on DEXs via LOYAL hub',
            'True ownership of rewards',
            'Transfer tokens between programs',
          ],
        },
      ],
    },
    {
      id: 'tokenomics',
      title: 'LOYAL Token Economics',
      subtitle: '10B total supply with deflationary mechanics',
      tokenomics: [
        { category: 'Ecosystem Fund (DAO)', percentage: '41%', amount: '4.1B', vesting: '5-year linear unlock' },
        { category: 'Token Sales', percentage: '30%', amount: '3B', vesting: '12-18 month vesting' },
        { category: 'Team & Advisors', percentage: '20%', amount: '2B', vesting: '1yr lock + 3yr vest' },
        { category: 'Initial Liquidity', percentage: '5%', amount: '500M', vesting: 'TGE unlock' },
        { category: 'Marketing & Airdrop', percentage: '4%', amount: '400M', vesting: 'Fast unlock' },
      ],
    },
    {
      id: 'business-model',
      title: 'Revenue Model',
      subtitle: 'Staking-based with transaction fees',
      revenue: [
        { 
          source: 'Merchant Staking Deposits', 
          detail: 'Basic $1K | Pro $5K | Enterprise $15K',
          mechanism: 'Refundable collateral with minimum 1-month lock',
          icon: Lock 
        },
        { 
          source: 'Transaction Fees - Burn', 
          detail: '8% on M-token → LOYAL swaps (deflationary)',
          mechanism: 'Burns LOYAL, reducing supply and increasing scarcity',
          icon: Flame 
        },
        { 
          source: 'Transaction Fees - Revenue', 
          detail: '0.5% on LOYAL → M-token swaps',
          mechanism: 'Goes to Treasury/Liquidity Pool Reserve',
          icon: DollarSign 
        },
        { 
          source: 'Tier-Based Features', 
          detail: 'Higher stakes unlock premium features',
          mechanism: 'Analytics, API access, NFT rewards, White Label',
          icon: BarChart3 
        },
      ],
    },
    {
      id: 'hub-spoke',
      title: 'Hub-and-Spoke Liquidity Model',
      subtitle: 'LOYAL as universal intermediary',
      description: 'All merchant loyalty tokens (M-tokens) pair with LOYAL, creating a unified liquidity hub. Any M-token can be exchanged for any other via LOYAL bridge.',
      hubSpoke: {
        center: 'LOYAL Token',
        spokes: ['Restaurant Points', 'Coffee Miles', 'Retail Rewards', 'Fitness Tokens', 'Spa Points'],
        mechanism: 'M-Token A → LOYAL → M-Token B (atomic swap)',
      },
    },
    {
      id: 'merchant-economics',
      title: 'Merchant Economics',
      subtitle: 'How merchants save money and earn revenue',
      economics: [
        { 
          benefit: 'Lower Loyalty Costs',
          description: 'Conversion fees (5-15%) built into initial M-token pricing mean merchants buy back tokens cheaper than face value',
          impact: '30-50% reduction vs traditional programs'
        },
        { 
          benefit: 'No Monthly Fees',
          description: 'One-time refundable stake replaces $99-499/month subscriptions',
          impact: '$1,200-6,000 annual savings'
        },
        { 
          benefit: 'Revenue from Unredeemed',
          description: 'Unused loyalty tokens remain in circulation, no liability',
          impact: '20-30% of issued points never redeemed'
        },
        { 
          benefit: 'LOYAL Stake Appreciation',
          description: 'Staked LOYAL may appreciate as platform grows',
          impact: 'Potential upside on locked collateral'
        },
      ],
    },
    {
      id: 'traction',
      title: 'Traction & Status',
      subtitle: 'Platform ready for launch',
      metrics: [
        { label: 'Platform Status', value: 'Live on BASE Network', icon: Zap },
        { label: 'Smart Contracts', value: 'Deployed & Tested', icon: Shield },
        { label: 'Target', value: 'First 100 SMBs in Q2 2025', icon: Target },
        { label: 'MVP', value: 'Full functionality ready', icon: TrendingUp },
      ],
    },
    {
      id: 'competition',
      title: 'Competitive Advantage',
      subtitle: 'Why Loyal Spark wins in SMB segment',
      advantages: [
        { point: 'Staking model vs 15-30% fees or $99-499/mo subscriptions', icon: DollarSign },
        { point: 'Native Web3 vs Web2 adapters', icon: Globe },
        { point: 'Hub-and-spoke liquidity vs siloed programs', icon: Zap },
        { point: 'Deflationary tokenomics vs inflationary rewards', icon: Flame },
        { point: 'SMB-focused ($1K entry) vs enterprise-only solutions', icon: Store },
        { point: 'BASE Network scalability & low costs', icon: TrendingUp },
      ],
    },
    {
      id: 'roadmap',
      title: 'Roadmap',
      subtitle: '18-month execution plan',
      quarters: [
        {
          period: 'Q2 2025',
          milestones: ['Beta launch with 100 SMB merchants', 'LOYAL token TGE & DEX listing', 'Mobile wallet integration'],
        },
        {
          period: 'Q3 2025',
          milestones: ['DEX aggregator integration', '1,000 active merchants', 'Pro tier features release'],
        },
        {
          period: 'Q4 2025',
          milestiles: ['Hub-and-spoke liquidity live', '5,000 merchants onboarded', 'Enterprise tier launch'],
        },
        {
          period: 'Q1 2026',
          milestones: ['10,000+ merchants', 'Multi-chain expansion planning', 'Strategic partnerships', 'Series A preparation'],
        },
      ],
    },
    {
      id: 'team',
      title: 'Team',
      subtitle: 'Experienced builders in Web3, fintech & SMB solutions',
      description: 'Our team combines deep expertise in blockchain technology, DeFi tokenomics, loyalty program design, and small business solutions. We have experience building and scaling platforms that serve thousands of merchants and millions of end users.',
    },
    {
      id: 'financials',
      title: 'Financial Projections',
      subtitle: '3-year growth trajectory for SMB market',
      projections: [
        { 
          year: '2025', 
          merchants: '1,000', 
          tvl: '$2M',
          txVolume: '$500K',
          revenue: '$50K',
          notes: 'Beta launch + initial traction'
        },
        { 
          year: '2026', 
          merchants: '10,000', 
          tvl: '$25M',
          txVolume: '$10M',
          revenue: '$1.5M',
          notes: 'Product-market fit + scaling'
        },
        { 
          year: '2027', 
          merchants: '50,000',
          tvl: '$150M',
          txVolume: '$100M', 
          revenue: '$12M',
          notes: 'Market leadership in SMB segment'
        },
      ],
    },
    {
      id: 'ask',
      title: 'The Ask',
      subtitle: 'Seed Round: $500K - $1M',
      ask: {
        amount: '$500K - $1M',
        use: [
          { category: 'Product Development', percentage: '35%', detail: 'Engineering team, smart contract audits, features' },
          { category: 'SMB Merchant Acquisition', percentage: '35%', detail: 'Sales team, marketing, partnerships' },
          { category: 'Operations & Infrastructure', percentage: '20%', detail: 'Backend, support, security' },
          { category: 'Legal & Compliance', percentage: '10%', detail: 'Token regulatory, smart contract audits' },
        ],
        runway: '18 months to product-market fit & Series A',
        valuation: 'Pre-money: $4M-5M',
      },
    },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="relative h-9 w-9 rounded-lg bg-foreground flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <Sparkles className="h-5 w-5 text-background" />
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  Back to Home
                </Button>
              </Link>
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-12">
          <div className="max-w-5xl mx-auto space-y-8">
            {slides.map((slide, index) => (
              <Card key={slide.id} className="border bg-card overflow-hidden">
                <CardContent className="p-12">
                  {/* Cover Slide */}
                  {slide.id === 'cover' && (
                    <div className="text-center space-y-6 py-16">
                      <div className="mx-auto h-24 w-24 rounded-2xl bg-foreground flex items-center justify-center mb-8">
                        <slide.icon className="h-12 w-12 text-background" />
                      </div>
                      <h1 className="text-6xl font-bold text-foreground tracking-tight">
                        {slide.title}
                      </h1>
                      <p className="text-2xl text-muted-foreground font-medium">
                        {slide.subtitle}
                      </p>
                      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        {slide.tagline}
                      </p>
                      <div className="pt-8 flex flex-col items-center gap-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
                          <div className="h-2 w-2 rounded-full bg-foreground" />
                          <span className="text-sm font-medium text-foreground">Built on BASE Network</span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
                          <Coins className="h-4 w-4 text-foreground" />
                          <span className="text-sm font-medium text-foreground">LOYAL Token | 10B Supply</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Problem Slide */}
                  {slide.id === 'problem' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {slide.items?.map((item, i) => (
                          <div key={i} className="flex items-start gap-4 p-6 rounded-xl bg-secondary/50 border border-border">
                            <div className="h-12 w-12 rounded-lg bg-foreground/10 flex items-center justify-center flex-shrink-0">
                              <item.icon className="h-6 w-6 text-foreground" />
                            </div>
                            <p className="text-base font-medium text-foreground leading-relaxed pt-2">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Solution Slide */}
                  {slide.id === 'solution' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {slide.items?.map((item, i) => (
                          <div key={i} className="flex items-start gap-4 p-6 rounded-xl bg-foreground text-background">
                            <div className="h-12 w-12 rounded-lg bg-background/10 flex items-center justify-center flex-shrink-0">
                              <item.icon className="h-6 w-6 text-background" />
                            </div>
                            <p className="text-base font-medium leading-relaxed pt-2">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Slide */}
                  {slide.id === 'market' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {slide.stats?.map((stat, i) => (
                          <div key={i} className="p-8 rounded-xl border border-border bg-secondary/30 text-center">
                            <div className="text-5xl font-bold text-foreground mb-2">
                              {stat.value}
                            </div>
                            <div className="text-base font-medium text-foreground mb-2">
                              {stat.label}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {stat.trend}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product Slide */}
                  {slide.id === 'product' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid md:grid-cols-2 gap-8">
                        {slide.features?.map((feature, i) => (
                          <div key={i} className="p-8 rounded-xl border border-border bg-card">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="h-12 w-12 rounded-lg bg-foreground flex items-center justify-center">
                                <feature.icon className="h-6 w-6 text-background" />
                              </div>
                              <h3 className="text-2xl font-bold text-foreground">{feature.title}</h3>
                            </div>
                            <ul className="space-y-3">
                              {feature.items.map((item, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                                  <span className="text-base text-foreground">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tokenomics Slide */}
                  {slide.id === 'tokenomics' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="space-y-4">
                        {slide.tokenomics?.map((item, i) => (
                          <div key={i} className="flex items-center gap-6 p-6 rounded-xl border border-border bg-secondary/30">
                            <div className="flex-shrink-0">
                              <div className="text-3xl font-bold text-foreground">
                                {item.percentage}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {item.amount}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-lg font-semibold text-foreground mb-1">
                                {item.category}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.vesting}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Business Model Slide */}
                  {slide.id === 'business-model' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="space-y-4">
                        {slide.revenue?.map((item, i) => (
                          <div key={i} className="p-6 rounded-xl border border-border bg-card">
                            <div className="flex items-start gap-4 mb-4">
                              <div className="h-12 w-12 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                                <item.icon className="h-6 w-6 text-background" />
                              </div>
                              <div className="flex-1">
                                <div className="text-xl font-bold text-foreground mb-1">
                                  {item.source}
                                </div>
                                <div className="text-base text-muted-foreground mb-2">
                                  {item.detail}
                                </div>
                              </div>
                            </div>
                            <div className="pl-16 text-sm text-muted-foreground">
                              {item.mechanism}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hub and Spoke Slide */}
                  {slide.id === 'hub-spoke' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground mb-4">{slide.subtitle}</p>
                        <p className="text-base text-muted-foreground">{slide.description}</p>
                      </div>
                      <div className="relative py-12">
                        {/* Center Hub */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                          <div className="h-32 w-32 rounded-full bg-foreground flex items-center justify-center shadow-lg">
                            <div className="text-center">
                              <Coins className="h-8 w-8 text-background mx-auto mb-1" />
                              <div className="text-sm font-bold text-background">{slide.hubSpoke?.center}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Spokes */}
                        <div className="grid grid-cols-3 gap-8 relative">
                          {slide.hubSpoke?.spokes.map((spoke, i) => (
                            <div key={i} className="flex justify-center">
                              <div className="p-4 rounded-xl border-2 border-border bg-secondary/50 text-center min-w-[140px]">
                                <Store className="h-6 w-6 text-foreground mx-auto mb-2" />
                                <div className="text-sm font-medium text-foreground">{spoke}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-center p-6 rounded-xl bg-foreground/5 border border-border">
                        <p className="text-base font-medium text-foreground">
                          {slide.hubSpoke?.mechanism}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Merchant Economics Slide */}
                  {slide.id === 'merchant-economics' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {slide.economics?.map((item, i) => (
                          <div key={i} className="p-6 rounded-xl border border-border bg-card">
                            <div className="text-lg font-bold text-foreground mb-3">
                              {item.benefit}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {item.description}
                            </p>
                            <div className="pt-3 border-t border-border">
                              <div className="text-base font-semibold text-foreground">
                                {item.impact}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Traction Slide */}
                  {slide.id === 'traction' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {slide.metrics?.map((metric, i) => (
                          <div key={i} className="p-8 rounded-xl border border-border bg-card text-center">
                            <div className="mx-auto h-14 w-14 rounded-xl bg-foreground flex items-center justify-center mb-4">
                              <metric.icon className="h-7 w-7 text-background" />
                            </div>
                            <div className="text-sm font-medium text-muted-foreground mb-2">
                              {metric.label}
                            </div>
                            <div className="text-lg font-semibold text-foreground">
                              {metric.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competition Slide */}
                  {slide.id === 'competition' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {slide.advantages?.map((adv, i) => (
                          <div key={i} className="flex items-start gap-4 p-6 rounded-xl bg-foreground text-background">
                            <div className="h-10 w-10 rounded-lg bg-background/10 flex items-center justify-center flex-shrink-0">
                              <adv.icon className="h-5 w-5 text-background" />
                            </div>
                            <p className="text-base font-medium leading-relaxed pt-1">
                              {adv.point}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Roadmap Slide */}
                  {slide.id === 'roadmap' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {slide.quarters?.map((quarter, i) => (
                          <div key={i} className="p-6 rounded-xl border border-border bg-card">
                            <div className="text-2xl font-bold text-foreground mb-4">
                              {quarter.period}
                            </div>
                            <ul className="space-y-2">
                              {quarter.milestones.map((milestone, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <ArrowRight className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                                  <span className="text-base text-foreground">{milestone}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Team Slide */}
                  {slide.id === 'team' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground mb-6">{slide.subtitle}</p>
                      </div>
                      <div className="p-8 rounded-xl border border-border bg-secondary/30">
                        <p className="text-lg text-foreground leading-relaxed">
                          {slide.description}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="p-6 rounded-xl border border-border bg-card text-center">
                          <Users className="h-10 w-10 text-foreground mx-auto mb-3" />
                          <div className="text-base font-semibold text-foreground">Web3 & DeFi</div>
                        </div>
                        <div className="p-6 rounded-xl border border-border bg-card text-center">
                          <Store className="h-10 w-10 text-foreground mx-auto mb-3" />
                          <div className="text-base font-semibold text-foreground">SMB Solutions</div>
                        </div>
                        <div className="p-6 rounded-xl border border-border bg-card text-center">
                          <BarChart3 className="h-10 w-10 text-foreground mx-auto mb-3" />
                          <div className="text-base font-semibold text-foreground">Loyalty Programs</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Financials Slide */}
                  {slide.id === 'financials' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b-2 border-border">
                              <th className="text-left p-4 text-base font-semibold text-foreground">Year</th>
                              <th className="text-left p-4 text-base font-semibold text-foreground">Merchants</th>
                              <th className="text-left p-4 text-base font-semibold text-foreground">Total Value Locked</th>
                              <th className="text-left p-4 text-base font-semibold text-foreground">Tx Volume</th>
                              <th className="text-left p-4 text-base font-semibold text-foreground">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slide.projections?.map((proj, i) => (
                              <tr key={i} className="border-b border-border hover:bg-secondary/20">
                                <td className="p-4 text-lg font-bold text-foreground">{proj.year}</td>
                                <td className="p-4 text-base text-foreground">{proj.merchants}</td>
                                <td className="p-4 text-base text-foreground">{proj.tvl}</td>
                                <td className="p-4 text-base text-foreground">{proj.txVolume}</td>
                                <td className="p-4 text-base font-semibold text-foreground">{proj.revenue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-6 space-y-3">
                        {slide.projections?.map((proj, i) => (
                          <div key={i} className="p-4 rounded-lg bg-secondary/30 border border-border">
                            <div className="text-sm text-muted-foreground">
                              <span className="font-semibold text-foreground">{proj.year}:</span> {proj.notes}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* The Ask Slide */}
                  {slide.id === 'ask' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-2xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      
                      <div className="p-8 rounded-xl bg-foreground text-background text-center">
                        <div className="text-5xl font-bold mb-4">{slide.ask?.amount}</div>
                        <div className="text-xl">{slide.ask?.valuation}</div>
                      </div>

                      <div>
                        <h3 className="text-2xl font-bold text-foreground mb-4">Use of Funds</h3>
                        <div className="space-y-3">
                          {slide.ask?.use.map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                              <div className="flex-shrink-0 text-2xl font-bold text-foreground w-16">
                                {item.percentage}
                              </div>
                              <div className="flex-1">
                                <div className="text-lg font-semibold text-foreground">
                                  {item.category}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.detail}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-6 rounded-xl bg-secondary/30 border border-border text-center">
                        <div className="text-lg font-semibold text-foreground">
                          Runway: {slide.ask?.runway}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Final CTA Card */}
            <Card className="border-2 bg-foreground text-background overflow-hidden">
              <CardContent className="p-12 text-center space-y-6">
                <h2 className="text-4xl font-bold">Let's Build the Future of Loyalty</h2>
                <p className="text-xl opacity-90 max-w-2xl mx-auto">
                  Join us in revolutionizing how SMB merchants reward their customers with blockchain technology
                </p>
                <div className="flex gap-4 justify-center pt-4">
                  <Button size="lg" variant="secondary" className="text-lg px-8">
                    Schedule Meeting
                  </Button>
                  <Button size="lg" variant="outline" className="text-lg px-8 border-background/20 hover:bg-background/10">
                    Download Deck
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8 mt-16">
          <div className="container mx-auto px-6 text-center text-muted-foreground">
            <p className="text-sm">
              © 2025 Loyal Spark. Built on BASE Network. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
};

export default PitchDeck;
