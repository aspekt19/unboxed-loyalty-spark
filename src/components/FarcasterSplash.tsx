import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface FarcasterSplashProps {
  onLaunch: () => void;
}

export function FarcasterSplash({ onLaunch }: FarcasterSplashProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-[120px] font-black text-white tracking-tight">
          LS
        </h1>
      </div>
      
      <div className="w-full max-w-md pb-8">
        <Button 
          onClick={onLaunch}
          variant="outline"
          size="lg"
          className="w-full bg-white hover:bg-gray-100 text-black border-0 h-14 text-lg font-semibold"
        >
          Launch Loyal Spark
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <p className="text-center text-gray-400 text-sm mt-4">
          https://loyalspark.online/
        </p>
      </div>
    </div>
  );
}
