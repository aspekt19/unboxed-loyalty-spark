import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-foreground text-background flex items-center justify-center rounded-lg font-black text-lg">
              LS
            </div>
            <span className="font-bold text-xl">Loyal Spark</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="rounded-full">
              Base
            </Button>
            <Button variant="outline" className="rounded-full">
              0xDd...59Bb
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="text-center max-w-5xl mx-auto space-y-8">
          <div className="inline-block px-4 py-1.5 rounded-full border border-border text-sm text-muted-foreground mb-4">
            • BUILT ON BASE NETWORK
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tight">
            Discover loyalty<br />rewards reimagined.
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Mint, manage and trade loyalty tokens on-chain. Built for the next generation of customer engagement.
          </p>
          
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button 
              size="lg" 
              className="rounded-full px-8"
              onClick={() => navigate('/app')}
            >
              Launch App
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-full px-8"
              onClick={() => navigate('/pitch')}
            >
              Learn more
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">POWERED BY</p>
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <span>BASE</span>
              <span>Web3</span>
              <span>ERC-20</span>
              <span>Decentralized</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
