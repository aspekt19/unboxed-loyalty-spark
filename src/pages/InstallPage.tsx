import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
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
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="container max-w-2xl mx-auto py-16 px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
              <Smartphone className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Install Loyal Spark</h1>
            <p className="text-lg text-muted-foreground">
              Get the best experience with our mobile app
            </p>
          </div>

          {isInstalled ? (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                  <div>
                    <CardTitle className="text-green-900">App Installed!</CardTitle>
                    <CardDescription className="text-green-700">
                      You can now use Loyal Spark from your home screen
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link to="/customer">
                  <Button className="w-full" size="lg">
                    Open App
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {isIOS ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Install on iOS</CardTitle>
                    <CardDescription>Follow these steps to install on your iPhone/iPad</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tap the Share button</p>
                        <p className="text-xs text-muted-foreground">
                          Look for the share icon in Safari (box with arrow pointing up)
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="text-sm font-medium">Select "Add to Home Screen"</p>
                        <p className="text-xs text-muted-foreground">
                          Scroll down and find "Add to Home Screen" option
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tap "Add"</p>
                        <p className="text-xs text-muted-foreground">
                          The app will appear on your home screen
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : deferredPrompt ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Install Loyal Spark</CardTitle>
                    <CardDescription>
                      Install the app for quick access and offline functionality
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={handleInstallClick} 
                      className="w-full" 
                      size="lg"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Install App
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Install on Android</CardTitle>
                    <CardDescription>Follow these steps to install on your device</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tap the menu button</p>
                        <p className="text-xs text-muted-foreground">
                          Look for three dots in your browser (Chrome, Firefox, etc.)
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="text-sm font-medium">Select "Add to Home screen" or "Install app"</p>
                        <p className="text-xs text-muted-foreground">
                          The option may vary depending on your browser
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tap "Install" or "Add"</p>
                        <p className="text-xs text-muted-foreground">
                          The app will appear on your home screen
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="mt-8 text-center">
                <Link to="/customer">
                  <Button variant="outline" size="lg">
                    Continue in Browser
                  </Button>
                </Link>
              </div>
            </>
          )}

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Quick Access</h3>
              <p className="text-sm text-muted-foreground">
                Launch from your home screen
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Native Feel</h3>
              <p className="text-sm text-muted-foreground">
                Works like a native app
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Offline Ready</h3>
              <p className="text-sm text-muted-foreground">
                Works without internet
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
