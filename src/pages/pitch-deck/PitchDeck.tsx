import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Users, DollarSign, Target, Zap, Shield, Globe, Wallet, Store, ShoppingBag, LineChart, Lock, Coins, BarChart3, Flame, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

const PitchDeck = () => {
  const slides = [
    {
      id: 'cover',
      title: 'Loyal Spark',
      subtitle: 'Blockchain Loyalty Rewards for SMBs',
      tagline: 'Book loyalty rewards with merchants, not middlemen',
      icon: Sparkles,
    },
    {
      id: 'problem',
      title: 'Problem',
      items: [
        { text: 'High monthly fees ($99-499) or revenue cuts (15-30%)', icon: DollarSign },
        { text: 'Customers have no ownership or control of rewards', icon: Users },
        { text: 'Siloed programs - no way to exchange or trade', icon: Lock },
      ],
    },
    {
      id: 'solution',
      title: 'Solution',
      subtitle: 'A blockchain platform where merchants deploy loyalty tokens to:',
      solutionColumns: [
        {
          title: 'SAVE',
          subtitle: 'MONEY',
          description: 'No monthly fees - just stake LOYAL tokens (refundable)',
          icon: DollarSign,
        },
        {
          title: 'EARN',
          subtitle: 'REVENUE',
          description: 'Unredeemed tokens stay valuable, no liability',
          icon: TrendingUp,
        },
        {
          title: 'EMPOWER',
          subtitle: 'CUSTOMERS',
          description: 'True ownership - customers can trade and transfer',
          icon: Wallet,
        },
      ],
    },
    {
      id: 'validation',
      title: 'Market Validation',
      stats: [
        { value: '630,000+', label: 'SMBs using loyalty programs in US alone' },
        { value: '$100B', label: 'Unredeemed loyalty rewards annually' },
      ],
    },
    {
      id: 'market-size',
      title: 'Market Size',
      subtitle: '$200B+ Global Loyalty Market',
      marketData: {
        tam: { value: '$200B+', label: 'Total Available Market', description: 'Global loyalty rewards market' },
        sam: { value: '$60B', label: 'Serviceable Available Market', description: 'SMB segment (50M merchants)' },
        share: { value: '$150M', label: 'Target Market Share (Year 1)', description: '1,000 merchants by Q4 2026' },
      },
    },
    {
      id: 'product',
      title: 'Product',
      subtitle: 'How it works',
      productFlow: {
        merchant: [
          { step: 'Deploy Token', description: 'Create custom ERC-20 loyalty token', icon: Sparkles },
          { step: 'Issue Rewards', description: 'Mint tokens to customers via vouchers', icon: UserPlus },
          { step: 'Manage Program', description: 'Track holders, create offers, earn fees', icon: BarChart3 },
        ],
        customer: [
          { step: 'Collect Rewards', description: 'Receive loyalty tokens from merchants', icon: ShoppingBag },
          { step: 'Redeem or Trade', description: 'Use for vouchers or swap via LOYAL hub', icon: LineChart },
          { step: 'Own Forever', description: 'True ownership - stored in your wallet', icon: Wallet },
        ],
      },
    },
    {
      id: 'business-model',
      title: 'Business Model',
      revenue: [
        { source: 'Merchant Staking', detail: '$1K - $15K refundable deposits', icon: Lock },
        { source: 'Transaction Fees', detail: '0.5% - 8% on token swaps', icon: DollarSign },
        { source: 'Premium Features', detail: 'API, Analytics, NFT rewards', icon: Zap },
      ],
    },
    {
      id: 'adoption',
      title: 'Adoption Strategy',
      subtitle: 'Path to 1,000 merchants by Q4 2026',
      adoption: [
        { phase: 'Beta (Q1-Q2 2026)', target: '10 merchants', focus: 'Product testing & feedback' },
        { phase: 'Launch (Q3 2026)', target: '100 merchants', focus: 'Local market penetration' },
        { phase: 'Scale (Q4 2026)', target: '500 merchants', focus: 'Regional expansion' },
        { phase: 'Growth (Q1-Q2 2027)', target: '1,000+ merchants', focus: 'National presence' },
      ],
    },
    {
      id: 'competition',
      title: 'Competition',
      subtitle: 'Traditional vs Blockchain Loyalty',
      competitive: {
        traditional: ['Square Loyalty: $99-499/mo', 'LoyaltyLion: 15-30% fees', 'Yotpo: Enterprise only', 'Siloed programs'],
        loyalSpark: ['Refundable stake', 'Token economics', 'SMB-friendly ($1K)', 'Interoperable'],
      },
    },
    {
      id: 'advantages',
      title: 'Competitive Advantages',
      subtitle: 'Why we win',
      advantages: [
        { point: 'Staking model - No recurring fees', icon: DollarSign },
        { point: 'Hub-and-spoke - Trade any loyalty token', icon: Zap },
        { point: 'Deflationary - 8% burn reduces supply', icon: Flame },
        { point: 'BASE Network - Low cost, high speed', icon: Globe },
        { point: 'SMB focused - $1K entry vs $10K+', icon: Store },
        { point: 'True ownership - Customers control assets', icon: Wallet },
      ],
    },
    {
      id: 'traction',
      title: 'Current Status',
      metrics: [
        { label: 'Platform', value: 'Live on BASE', icon: Zap },
        { label: 'Contracts', value: 'Deployed & Tested', icon: Shield },
        { label: 'Website', value: 'loyalspark.online', icon: Globe },
        { label: 'Target', value: '100 SMBs Q2 2026', icon: Target },
      ],
    },
  ];

  return (
      <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-9 w-9 rounded-lg transition-transform duration-300 group-hover:scale-105" 
              />
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
                      <img 
                        src="/new-favicon.png" 
                        alt="Loyal Spark" 
                        className="mx-auto h-24 w-24 rounded-2xl mb-8" 
                      />
                      <h1 className="text-6xl font-bold text-foreground tracking-tight">
                        {slide.title}
                      </h1>
                      <p className="text-2xl text-muted-foreground font-medium">
                        {slide.subtitle}
                      </p>
                      <p className="text-lg text-muted-foreground max-w-2xl mx-auto italic">
                        {slide.tagline}
                      </p>
                      <div className="pt-8 flex flex-col items-center gap-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
                          <div className="h-2 w-2 rounded-full bg-foreground" />
                          <span className="text-sm font-medium text-foreground">Built on BASE Network</span>
                        </div>
                        <a href="https://loyalspark.online/" target="_blank" rel="noopener noreferrer" className="text-base font-medium text-foreground hover:underline">
                          loyalspark.online
                        </a>
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
                        <h2 className="text-5xl font-bold text-foreground">{slide.title}</h2>
                      </div>
                      <div className="space-y-4">
                        {slide.items?.map((item, i) => (
                          <div key={i} className="flex items-start gap-4 p-6 rounded-xl bg-secondary/50 border border-border">
                            <div className="h-12 w-12 rounded-lg bg-foreground/10 flex items-center justify-center flex-shrink-0">
                              <item.icon className="h-6 w-6 text-foreground" />
                            </div>
                            <p className="text-lg font-medium text-foreground leading-relaxed pt-2">
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
                        <h2 className="text-5xl font-bold text-foreground mb-4">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        {slide.solutionColumns?.map((col, i) => (
                          <div key={i} className="text-center p-8 rounded-xl bg-foreground text-background">
                            <div className="mx-auto h-16 w-16 rounded-full bg-background/10 flex items-center justify-center mb-6">
                              <col.icon className="h-8 w-8 text-background" />
                            </div>
                            <div className="text-2xl font-bold mb-1">{col.title}</div>
                            <div className="text-xl font-semibold mb-4">{col.subtitle}</div>
                            <p className="text-sm leading-relaxed">{col.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Validation Slide */}
                  {slide.id === 'validation' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-5xl font-bold text-foreground">{slide.title}</h2>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        {slide.stats?.map((stat, i) => (
                          <div key={i} className="text-center p-12 rounded-xl border-2 border-border bg-secondary/30">
                            <div className="text-6xl font-bold text-foreground mb-4">
                              {stat.value}
                            </div>
                            <div className="text-lg font-medium text-muted-foreground">
                              {stat.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Size Slide */}
                  {slide.id === 'market-size' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="space-y-6">
                        {slide.marketData && Object.entries(slide.marketData).map(([key, data]) => (
                          <div key={key} className="p-8 rounded-xl border border-border bg-secondary/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-lg font-semibold text-muted-foreground mb-2">
                                  {data.label}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {data.description}
                                </div>
                              </div>
                              <div className="text-5xl font-bold text-foreground">
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
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-xl border border-border bg-card">
                          <h3 className="text-2xl font-bold text-foreground mb-6">For Merchants</h3>
                          <div className="space-y-4">
                            {slide.productFlow?.merchant.map((step, i) => (
                              <div key={i} className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                                  <step.icon className="h-5 w-5 text-background" />
                                </div>
                                <div>
                                  <div className="font-bold text-foreground mb-1">{step.step}</div>
                                  <div className="text-sm text-muted-foreground">{step.description}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-8 rounded-xl border border-border bg-card">
                          <h3 className="text-2xl font-bold text-foreground mb-6">For Customers</h3>
                          <div className="space-y-4">
                            {slide.productFlow?.customer.map((step, i) => (
                              <div key={i} className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                                  <step.icon className="h-5 w-5 text-background" />
                                </div>
                                <div>
                                  <div className="font-bold text-foreground mb-1">{step.step}</div>
                                  <div className="text-sm text-muted-foreground">{step.description}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
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
                        <h2 className="text-5xl font-bold text-foreground">{slide.title}</h2>
                      </div>
                      <div className="space-y-4">
                        {slide.revenue?.map((item, i) => (
                          <div key={i} className="flex items-start gap-6 p-8 rounded-xl border border-border bg-secondary/30">
                            <div className="h-14 w-14 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                              <item.icon className="h-7 w-7 text-background" />
                            </div>
                            <div className="flex-1">
                              <div className="text-2xl font-bold text-foreground mb-2">
                                {item.source}
                              </div>
                              <div className="text-base text-muted-foreground">
                                {item.detail}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Adoption Strategy Slide */}
                  {slide.id === 'adoption' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="space-y-4">
                        {slide.adoption?.map((item, i) => (
                          <div key={i} className="flex items-center gap-6 p-6 rounded-xl border border-border bg-card">
                            <div className="flex-1">
                              <div className="text-xl font-bold text-foreground mb-2">
                                {item.phase}
                              </div>
                              <div className="text-base text-muted-foreground">
                                Target: <span className="font-semibold text-foreground">{item.target}</span> | {item.focus}
                              </div>
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
                        <h2 className="text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="p-8 rounded-xl border border-border bg-secondary/30">
                          <h3 className="text-2xl font-bold text-foreground mb-6">Traditional Solutions</h3>
                          <ul className="space-y-3">
                            {slide.competitive?.traditional.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                                <span className="text-base text-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-8 rounded-xl bg-foreground text-background">
                          <h3 className="text-2xl font-bold mb-6">Loyal Spark</h3>
                          <ul className="space-y-3">
                            {slide.competitive?.loyalSpark.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-background mt-2 flex-shrink-0" />
                                <span className="text-base">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Competitive Advantages Slide */}
                  {slide.id === 'advantages' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-5xl font-bold text-foreground mb-2">{slide.title}</h2>
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

                  {/* Current Status Slide */}
                  {slide.id === 'traction' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-5xl font-bold text-foreground">{slide.title}</h2>
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

                </CardContent>
              </Card>
            ))}

            {/* Footer */}
            <Card className="border bg-card">
              <CardContent className="p-12 text-center space-y-4">
                <h2 className="text-4xl font-bold text-foreground">Thank You</h2>
                <p className="text-xl text-muted-foreground">
                  Let's build the future of loyalty rewards together
                </p>
                <div className="pt-4">
                  <a 
                    href="https://loyalspark.online/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-lg font-medium text-foreground hover:underline"
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
