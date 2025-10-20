import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Users, DollarSign, Target, Zap, Shield, Globe, ArrowRight, Wallet, Store, ShoppingBag, LineChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

const PitchDeck = () => {
  const slides = [
    {
      id: 'cover',
      title: 'Loyal Spark',
      subtitle: 'Blockchain Loyalty Rewards Platform',
      tagline: 'Transforming customer engagement with Web3 technology',
      icon: Sparkles,
    },
    {
      id: 'problem',
      title: 'The Problem',
      subtitle: 'Traditional loyalty programs are broken',
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
      subtitle: 'Decentralized loyalty tokens on BASE Network',
      items: [
        { text: 'Zero platform fees for merchants', icon: DollarSign },
        { text: 'True ownership for customers', icon: Wallet },
        { text: 'Tradeable on any DEX', icon: LineChart },
        { text: 'ERC-20 compatibility', icon: Zap },
      ],
    },
    {
      id: 'market',
      title: 'Market Opportunity',
      subtitle: 'Massive addressable market',
      stats: [
        { value: '$200B+', label: 'Global loyalty market', trend: '+15% CAGR' },
        { value: '90%', label: 'Consumers in loyalty programs', trend: '4.5B members' },
        { value: '$48B', label: 'Unredeemed points value', trend: 'Growing annually' },
        { value: '50M+', label: 'SMB merchants worldwide', trend: 'Target segment' },
      ],
    },
    {
      id: 'product',
      title: 'Product Features',
      subtitle: 'Built for merchants and customers',
      features: [
        {
          title: 'For Merchants',
          icon: Store,
          items: [
            'Deploy custom ERC-20 loyalty tokens',
            'Issue rewards with zero fees',
            'Create redeemable vouchers',
            'Track token holders in real-time',
          ],
        },
        {
          title: 'For Customers',
          icon: ShoppingBag,
          items: [
            'View all loyalty tokens in one place',
            'Redeem rewards instantly',
            'Trade tokens on DEXs',
            'True ownership of rewards',
          ],
        },
      ],
    },
    {
      id: 'business-model',
      title: 'Business Model',
      subtitle: 'Multiple revenue streams',
      revenue: [
        { source: 'Premium merchant features', value: '$99-499/mo', status: 'Q2 2025' },
        { source: 'Transaction fees (DEX integration)', value: '0.5% per trade', status: 'Q3 2025' },
        { source: 'White-label solutions', value: 'Enterprise pricing', status: 'Q4 2025' },
        { source: 'API access for integrations', value: 'Usage-based', status: 'Q1 2026' },
      ],
    },
    {
      id: 'traction',
      title: 'Traction & Metrics',
      subtitle: 'Early validation and growth',
      metrics: [
        { label: 'Platform Status', value: 'Live on BASE Network', icon: Zap },
        { label: 'Technology', value: 'Smart contracts deployed', icon: Shield },
        { label: 'Target', value: 'First 100 merchants in Q2 2025', icon: Target },
        { label: 'Validation', value: 'MVP with full functionality', icon: TrendingUp },
      ],
    },
    {
      id: 'competition',
      title: 'Competitive Advantage',
      subtitle: 'Why Loyal Spark wins',
      advantages: [
        { point: 'Zero platform fees vs 15-30% traditional', icon: DollarSign },
        { point: 'Native Web3 vs Web2 adapters', icon: Globe },
        { point: 'Instant liquidity via DEXs', icon: Zap },
        { point: 'BASE Network scalability', icon: TrendingUp },
      ],
    },
    {
      id: 'roadmap',
      title: 'Roadmap',
      subtitle: '18-month execution plan',
      quarters: [
        {
          period: 'Q2 2025',
          milestones: ['Launch beta program', '100 merchant onboarding', 'Mobile wallet integration'],
        },
        {
          period: 'Q3 2025',
          milestones: ['DEX aggregator launch', '1,000 active merchants', 'Premium tier release'],
        },
        {
          period: 'Q4 2025',
          milestones: ['Multi-chain expansion', '10,000 merchants', 'Enterprise solutions'],
        },
        {
          period: 'Q1 2026',
          milestones: ['Global marketplace', 'Strategic partnerships', 'Series A raise'],
        },
      ],
    },
    {
      id: 'team',
      title: 'Team',
      subtitle: 'Experienced builders in Web3 & loyalty',
      description: 'Our team combines deep expertise in blockchain technology, loyalty program design, and merchant solutions. We have experience building and scaling platforms that serve millions of users.',
    },
    {
      id: 'financials',
      title: 'Financial Projections',
      subtitle: '3-year growth trajectory',
      projections: [
        { year: '2025', merchants: '1,000', revenue: '$120K', mrr: '$10K' },
        { year: '2026', merchants: '10,000', revenue: '$2.4M', mrr: '$200K' },
        { year: '2027', merchants: '50,000', revenue: '$18M', mrr: '$1.5M' },
      ],
    },
    {
      id: 'ask',
      title: 'The Ask',
      subtitle: 'Seed Round',
      ask: {
        amount: '$500K - $1M',
        use: [
          { category: 'Product Development', percentage: '40%', detail: 'Engineering team & features' },
          { category: 'Merchant Acquisition', percentage: '30%', detail: 'Sales & marketing' },
          { category: 'Operations', percentage: '20%', detail: 'Infrastructure & support' },
          { category: 'Legal & Compliance', percentage: '10%', detail: 'Regulatory & smart contract audits' },
        ],
        runway: '18 months to Series A',
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
                      <div className="pt-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
                          <div className="h-2 w-2 rounded-full bg-foreground" />
                          <span className="text-sm font-medium text-foreground">Built on BASE Network</span>
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
                          <div key={i} className="flex items-center justify-between p-6 rounded-xl border border-border bg-secondary/30">
                            <div className="flex-1">
                              <div className="text-lg font-semibold text-foreground mb-1">
                                {item.source}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.status}
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                              {item.value}
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
                      <div className="space-y-4">
                        {slide.advantages?.map((adv, i) => (
                          <div key={i} className="flex items-center gap-4 p-6 rounded-xl bg-foreground text-background">
                            <div className="h-12 w-12 rounded-lg bg-background/10 flex items-center justify-center flex-shrink-0">
                              <adv.icon className="h-6 w-6 text-background" />
                            </div>
                            <p className="text-lg font-medium">
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
                          <div key={i} className="p-6 rounded-xl border border-border bg-secondary/30">
                            <div className="text-xl font-bold text-foreground mb-4">
                              {quarter.period}
                            </div>
                            <ul className="space-y-2">
                              {quarter.milestones.map((milestone, j) => (
                                <li key={j} className="flex items-start gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-foreground mt-2 flex-shrink-0" />
                                  <span className="text-sm text-foreground">{milestone}</span>
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
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="p-8 rounded-xl border border-border bg-secondary/30">
                        <p className="text-lg text-foreground leading-relaxed">
                          {slide.description}
                        </p>
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
                      <div className="space-y-4">
                        {slide.projections?.map((proj, i) => (
                          <div key={i} className="p-6 rounded-xl border border-border bg-card">
                            <div className="grid grid-cols-4 gap-6">
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">Year</div>
                                <div className="text-2xl font-bold text-foreground">{proj.year}</div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">Merchants</div>
                                <div className="text-2xl font-bold text-foreground">{proj.merchants}</div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">Revenue</div>
                                <div className="text-2xl font-bold text-foreground">{proj.revenue}</div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">MRR</div>
                                <div className="text-2xl font-bold text-foreground">{proj.mrr}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ask Slide */}
                  {slide.id === 'ask' && (
                    <div className="space-y-8">
                      <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Slide {index + 1}
                        </div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">{slide.title}</h2>
                        <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
                      </div>
                      <div className="text-center py-8">
                        <div className="text-6xl font-bold text-foreground mb-4">
                          {slide.ask?.amount}
                        </div>
                        <div className="text-xl text-muted-foreground mb-8">
                          {slide.ask?.runway}
                        </div>
                      </div>
                      <div className="space-y-4">
                        {slide.ask?.use.map((item, i) => (
                          <div key={i} className="p-6 rounded-xl border border-border bg-secondary/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-lg font-semibold text-foreground">
                                {item.category}
                              </span>
                              <span className="text-2xl font-bold text-foreground">
                                {item.percentage}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.detail}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Final CTA */}
            <Card className="border bg-foreground text-background overflow-hidden">
              <CardContent className="p-12 text-center space-y-6">
                <h2 className="text-4xl font-bold">Let's Build the Future of Loyalty</h2>
                <p className="text-xl opacity-90 max-w-2xl mx-auto">
                  Join us in revolutionizing customer engagement with blockchain technology
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Link to="/merchant">
                    <Button size="lg" variant="outline" className="bg-background text-foreground hover:bg-background/90 border-0">
                      Try the Platform
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8 mt-16">
          <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
            <p>© 2025 Loyal Spark. Built on BASE Network.</p>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
};

export default PitchDeck;
