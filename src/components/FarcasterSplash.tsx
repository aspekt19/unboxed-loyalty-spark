import { Button } from '@/components/ui/button';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useFarcasterInit } from '@/hooks/useFarcasterInit';

interface FarcasterSplashProps {
  onLaunch: () => void;
}

const FarcasterSplash = ({ onLaunch }: FarcasterSplashProps) => {
  // Use centralized Farcaster initialization - this handles sdk.actions.ready()
  const { isReady, isInitializing } = useFarcasterInit();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-16">
        <h1 className="text-[120px] font-bold text-foreground tracking-tight leading-none">
          LS
        </h1>
      </div>

      {/* Launch Button */}
      <Button
        onClick={onLaunch}
        size="lg"
        disabled={isInitializing}
        className="w-full max-w-md h-14 text-base font-medium rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
      >
        {isInitializing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Initializing...
          </>
        ) : (
          <>
            Launch Loyal Spark
            <ArrowUpRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>

      {/* Tagline */}
      <p className="mt-4 text-sm text-muted-foreground max-w-md text-center px-4">
        Loyalty rewards that grow. Earn tokens, save automatically, invest in DeFi.
      </p>

      {/* Links */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">https://loyalspark.online/</p>
        <a 
          href="https://x.com/Loyal_Spark" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          @Loyal_Spark
        </a>
      </div>
    </div>
  );
};

export default FarcasterSplash;
