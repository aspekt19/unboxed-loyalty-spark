import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';

interface FarcasterSplashProps {
  onLaunch: () => void;
}

const FarcasterSplash = ({ onLaunch }: FarcasterSplashProps) => {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-16">
        <h1 className="text-[120px] font-bold text-white tracking-tight leading-none">
          LS
        </h1>
      </div>

      {/* Launch Button */}
      <Button
        onClick={onLaunch}
        size="lg"
        className="w-full max-w-md h-14 text-base font-medium rounded-xl bg-white text-black hover:bg-white/90 transition-all duration-200"
      >
        Launch Loyal Spark
        <ArrowUpRight className="ml-2 h-5 w-5" />
      </Button>

      {/* URL */}
      <div className="mt-8">
        <p className="text-sm text-white/60">https://loyalspark.online/</p>
      </div>
    </div>
  );
};

export default FarcasterSplash;
