import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { isFarcasterContext } from "@/config/wagmi";
import { 
  Wallet, 
  Coins, 
  Gift, 
  TrendingUp, 
  Shield, 
  Zap,
  ChevronRight,
  ChevronLeft,
  Check
} from "lucide-react";

interface WelcomeFlowProps {
  userRole: "merchant" | "customer" | null;
}

const merchantSteps = [
  {
    title: "Welcome to Loyal Spark! 🎉",
    description: "The blockchain-powered loyalty platform that gives you and your customers true ownership.",
    icon: Wallet,
    content: "Unlike traditional loyalty systems, your tokens are real digital assets on the blockchain that customers actually own.",
  },
  {
    title: "Create Your Loyalty Program",
    description: "Deploy your own loyalty token in minutes - no coding required!",
    icon: Coins,
    content: "Set your token name, symbol, and initial supply. Your smart contract will be automatically deployed to the blockchain.",
  },
  {
    title: "Issue Rewards to Customers",
    description: "Scan customer QR codes or enter wallet addresses to reward them instantly.",
    icon: Gift,
    content: "Every reward is recorded on the blockchain, creating transparent and verifiable transaction history.",
  },
  {
    title: "Track & Analyze Performance",
    description: "Get deep insights into customer behavior with our CRM and analytics.",
    icon: TrendingUp,
    content: "RFM segmentation, customer tiers, campaign analytics - everything you need to grow your business.",
  },
  {
    title: "Automate Your Marketing",
    description: "Set up automation rules to engage customers at the right time.",
    icon: Zap,
    content: "Trigger personalized offers for at-risk customers, celebrate tier upgrades, and more - all automatically.",
  },
];

const customerSteps = [
  {
    title: "Welcome to Loyal Spark! 🎉",
    description: "Earn real rewards from your favorite businesses.",
    icon: Wallet,
    content: "Your loyalty rewards are real digital assets that you truly own. No crypto experience needed to get started!",
  },
  {
    title: "Sign In Easily",
    description: "Use email, passkey, or an existing wallet to get started.",
    icon: Shield,
    content: "Sign in with your email or passkey and a secure account is created automatically. You can also use MetaMask or Coinbase Wallet if you prefer.",
  },
  {
    title: "Earn Loyalty Tokens",
    description: "Show your QR code at checkout to earn tokens from participating merchants.",
    icon: Coins,
    content: "Each purchase earns you tokens. The more you spend, the higher your tier and better rewards!",
  },
  {
    title: "Redeem Amazing Rewards",
    description: "Browse the rewards catalog and activate vouchers with your tokens.",
    icon: Gift,
    content: "Vouchers are yours to use. Present them to merchants to claim your rewards.",
  },
  {
    title: "Your Tokens Have Real Value",
    description: "Unlike traditional points, your tokens can be traded or sold.",
    icon: TrendingUp,
    content: "Because they're on the blockchain, you can trade tokens on decentralized exchanges (DEX) or send them to friends!",
  },
];

export const WelcomeFlow = ({ userRole }: WelcomeFlowProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = userRole === "merchant" ? merchantSteps : customerSteps;

  useEffect(() => {
    // Radix renders dialogs through a portal. In Farcaster/Base App webviews
    // the overlay can be painted before the dialog content, leaving the user
    // on an apparently permanent black screen during portal navigation.
    // The miniapp already has a dedicated launch flow, so do not auto-open the
    // optional web onboarding modal there.
    if (isFarcasterContext()) {
      setIsOpen(false);
      return;
    }

    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem(`onboarding_seen_${userRole}`);
    if (!hasSeenOnboarding && userRole) {
      setIsOpen(true);
    }
  }, [userRole]);

  const handleComplete = () => {
    localStorage.setItem(`onboarding_seen_${userRole}`, "true");
    setIsOpen(false);
    setCurrentStep(0);
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[600px] sm:max-w-[600px] p-0 overflow-hidden rounded-xl">
        <div className="relative">
          {/* Progress bar */}
          <Progress value={progress} className="h-1 rounded-none" />

          {/* Content */}
          <div className="p-5 sm:p-8">
            {/* Icon */}
            <div className="mb-4 sm:mb-6 flex justify-center">
              <div className="p-3 sm:p-4 rounded-full bg-primary/10">
                <Icon className="h-9 w-9 sm:h-12 sm:w-12 text-primary" />
              </div>
            </div>

            {/* Title and description */}
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-2xl font-bold mb-2 text-balance break-words">{currentStepData.title}</h2>
              <p className="text-sm sm:text-lg text-muted-foreground mb-2 sm:mb-4 text-balance break-words">
                {currentStepData.description}
              </p>
            </div>

            {/* Content card */}
            <Card className="mb-4 sm:mb-6">
              <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
                <p className="text-xs sm:text-sm leading-relaxed break-words">{currentStepData.content}</p>
              </CardContent>
            </Card>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mb-4 sm:mb-6">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep
                      ? "w-8 bg-primary"
                      : index < currentStep
                      ? "w-2 bg-primary/50"
                      : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground px-2 sm:px-4"
              >
                Skip
              </Button>

              <div className="flex gap-2 ml-auto">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" onClick={handleBack}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {isLastStep ? (
                    <>
                      Get Started
                      <Check className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
