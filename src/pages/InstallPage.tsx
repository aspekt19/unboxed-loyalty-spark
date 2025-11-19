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
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Listen for beforeinstallprompt event
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
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад на главную
          </Button>

          <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="text-center space-y-4">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-primary shadow-glow">
                <Smartphone className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Установите Loyal Spark
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                Установите приложение на домашний экран для быстрого доступа и работы в офлайн режиме
              </p>
            </div>

            {isInstalled ? (
              <Card className="p-8 text-center space-y-4 bg-card-gradient border-accent/20 animate-scale-in">
                <CheckCircle className="h-16 w-16 text-accent mx-auto" />
                <h2 className="text-2xl font-bold text-foreground">Приложение установлено!</h2>
                <p className="text-muted-foreground">
                  Теперь вы можете запускать Loyal Spark прямо с домашнего экрана
                </p>
                <Button onClick={() => navigate('/')} className="mt-4" variant="default">
                  Открыть приложение
                </Button>
              </Card>
            ) : (
              <>
                {!isIOS && deferredPrompt && (
                  <Card className="p-8 bg-card-gradient border-primary/20 animate-scale-in">
                    <div className="text-center space-y-4">
                      <Download className="h-12 w-12 text-primary mx-auto" />
                      <h2 className="text-2xl font-bold">Быстрая установка</h2>
                      <p className="text-muted-foreground">
                        Нажмите кнопку ниже, чтобы установить приложение
                      </p>
                      <Button 
                        onClick={handleInstallClick}
                        size="lg"
                        className="w-full mt-4 shadow-glow hover:shadow-glow-orange transition-all duration-300"
                      >
                        <Download className="mr-2 h-5 w-5" />
                        Установить приложение
                      </Button>
                    </div>
                  </Card>
                )}

                {isIOS && (
                  <Card className="p-6 bg-card-gradient border-primary/20 animate-scale-in">
                    <h2 className="text-xl font-bold mb-4">Установка на iOS</h2>
                    <ol className="space-y-3 text-muted-foreground">
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          1
                        </span>
                        <span>Нажмите кнопку "Поделиться" в Safari</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          2
                        </span>
                        <span>Прокрутите вниз и выберите "На экран «Домой»"</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          3
                        </span>
                        <span>Нажмите "Добавить" в правом верхнем углу</span>
                      </li>
                    </ol>
                  </Card>
                )}

                {!isIOS && !deferredPrompt && (
                  <Card className="p-6 bg-card-gradient border-primary/20 animate-scale-in">
                    <h2 className="text-xl font-bold mb-4">Установка на Android</h2>
                    <ol className="space-y-3 text-muted-foreground">
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          1
                        </span>
                        <span>Откройте меню браузера (три точки)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          2
                        </span>
                        <span>Выберите "Добавить на главный экран" или "Установить приложение"</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                          3
                        </span>
                        <span>Подтвердите установку</span>
                      </li>
                    </ol>
                  </Card>
                )}
              </>
            )}

            <Card className="p-6 bg-card-gradient border-accent/20 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-xl font-bold mb-4">Преимущества установки</h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Быстрый доступ с домашнего экрана</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Работает в офлайн режиме</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Полноэкранный режим без браузера</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent mr-3 mt-0.5 flex-shrink-0" />
                  <span>Мгновенная загрузка</span>
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