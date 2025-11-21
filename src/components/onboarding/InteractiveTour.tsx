import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right";
}

interface InteractiveTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export const InteractiveTour = ({ steps, onComplete, onSkip }: InteractiveTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const target = document.querySelector(steps[currentStep]?.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
      
      // Scroll target into view
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Highlight target
      target.classList.add("ring-2", "ring-primary", "ring-offset-2");
      
      return () => {
        target.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      };
    }
  }, [currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible || !steps[currentStep] || !targetRect) {
    return null;
  }

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Calculate position based on target element
  const getPosition = () => {
    const offset = 10;
    switch (step.position) {
      case "top":
        return {
          top: targetRect.top - 200,
          left: targetRect.left + targetRect.width / 2,
          transform: "translateX(-50%)",
        };
      case "bottom":
        return {
          top: targetRect.bottom + offset,
          left: targetRect.left + targetRect.width / 2,
          transform: "translateX(-50%)",
        };
      case "left":
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left - 320,
          transform: "translateY(-50%)",
        };
      case "right":
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + offset,
          transform: "translateY(-50%)",
        };
      default:
        return { top: 0, left: 0 };
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" />

      {/* Tour card */}
      <div
        className="fixed z-50 w-80"
        style={getPosition()}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground">{step.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mt-1 -mr-1"
                onClick={handleSkip}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full ${
                      index === currentStep
                        ? "w-4 bg-primary"
                        : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>

              <Button size="sm" onClick={handleNext}>
                {isLastStep ? "Done" : "Next"}
                {!isLastStep && <ArrowRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

// Merchant tour steps
export const merchantTourSteps: TourStep[] = [
  {
    target: '[data-tour="merchant-tabs"]',
    title: "Navigation Tabs",
    content: "Access all merchant features: Dashboard, Customers, Programs, Rewards, and more.",
    position: "bottom",
  },
  {
    target: '[data-tour="create-program"]',
    title: "Create Your Program",
    content: "Start by creating your loyalty program. Deploy your token to the blockchain in minutes.",
    position: "right",
  },
  {
    target: '[data-tour="mint-tokens"]',
    title: "Issue Rewards",
    content: "Issue loyalty tokens to customers by scanning their QR code or entering their wallet address.",
    position: "left",
  },
  {
    target: '[data-tour="customers-crm"]',
    title: "CRM & Analytics",
    content: "View customer profiles, RFM segmentation, and detailed analytics to grow your business.",
    position: "right",
  },
  {
    target: '[data-tour="automation"]',
    title: "Marketing Automation",
    content: "Set up automated campaigns to engage customers at the right time with personalized offers.",
    position: "right",
  },
];

// Customer tour steps
export const customerTourSteps: TourStep[] = [
  {
    target: '[data-tour="customer-tabs"]',
    title: "Your Dashboard",
    content: "Navigate between your tokens, available rewards, vouchers, and more.",
    position: "bottom",
  },
  {
    target: '[data-tour="token-list"]',
    title: "Your Tokens",
    content: "View all your loyalty tokens from different merchants. Your balance updates in real-time!",
    position: "right",
  },
  {
    target: '[data-tour="qr-code"]',
    title: "Your QR Code",
    content: "Show this QR code to merchants at checkout to earn loyalty tokens.",
    position: "left",
  },
  {
    target: '[data-tour="rewards-catalog"]',
    title: "Browse Rewards",
    content: "Explore available rewards and activate vouchers using your tokens.",
    position: "right",
  },
  {
    target: '[data-tour="vouchers"]',
    title: "Your Vouchers",
    content: "Access your activated vouchers. Present them to merchants to claim your rewards!",
    position: "right",
  },
];
