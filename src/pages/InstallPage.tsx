import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPage = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background-secondary">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6 animate-fade-in-up"
            aria-label="Back to home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Button>

          <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="text-center space-y-4">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-primary shadow-glow">
                <Smartphone className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent pb-1">
                Install Loyal Spark
              </h1>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-lg mx-auto">
                Install the app to your home screen for fast access and offline use.
              </p>
            </div>

            {isInstalled ? (
              <Card className="p-8 text-center space-y-4 bg-card-gradient border-accent/20 animate-scale-in">
                <CheckCircle className="h-16 w-16 text-accent mx-auto" />
                <h2 className="text-2xl font-bold text-foreground">App installed!</h2>
                <p className="text-muted-foreground">
                  You can now launch Loyal Spark directly from your home screen.
                </p>
                <Button onClick={() => navigate('/')} className="mt-4" variant="default">
                  Open app
                </Button>
              </Card>
            ) : (
              <>
                {!isIOS && deferredPrompt && (
                  <Card className="p-8 bg-card-gradient border-primary/20 animate-scale-in">
                    <div className="text-center space-y-4">
                      <Download className="h-12 w-12 text-primary mx-auto" />
                      <h2 className="text-2xl font-bold">Quick install</h2>
                      <p className="text-muted-foreground">
                        Tap the button below to install the app.
                      </p>
                      <Button 
                        onClick={handleInstallClick}
                        size="lg"
                        className="w-full mt-4 shadow-glow hover:shadow-glow-orange transition-all duration-300"
                      >
                        <Download className="mr-2 h-5 w-5" />
                        Install app
                      </Button>
                    </div>
                  </Card>
                )}

                {isIOS && (
                  <Card className="p-6 bg-card-gradient border-primary/20 animate-scale-in">
                    <h2 className="text-xl font-bold mb-4">Install on iOS</h2>
                    <ol className="space-y-3 text-muted-foreground">
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          1
                        </span>
                        <span>Tap the “Share” button in Safari</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          2
                        </span>
                        <span>Scroll down and choose “Add to Home Screen”</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          3
                        </span>
                        <span>Tap “Add” in the top-right corner</span>
                      </li>
                    </ol>
                  </Card>
                )}

                {!isIOS && !deferredPrompt && (
                  <Card className="p-6 bg-card-gradient border-primary/20 animate-scale-in">
                    <h2 className="text-xl font-bold mb-4">Install on Android</h2>
                    <ol className="space-y-3 text-muted-foreground">
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          1
                        </span>
                        <span>Open the browser menu (three dots)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          2
                        </span>
                        <span>Choose “Add to Home screen” or “Install app”</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          3
                        </span>
                        <span>Confirm the installation</span>
                      </li>
                    </ol>
                  </Card>
                )}
              </>
            )}

            <Card className="p-6 bg-card-gradient border-accent/20 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-xl font-bold mb-4">Why install</h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Quick access from your home screen</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Works offline</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Full-screen experience without the browser UI</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Instant loading</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default InstallPage;
