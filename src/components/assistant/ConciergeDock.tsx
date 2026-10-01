import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LoyalSparkConcierge } from "@/components/assistant/LoyalSparkConcierge";
import { useAuth } from "@/contexts/AuthContext";

type Role = "merchant" | "shopper";

/** Chat launcher. Visible only after sign-in; sending also requires that session. */
export function ConciergeDock({ role }: { role: Role }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [visibleViewport, setVisibleViewport] = useState<{ height: number; top: number } | null>(null);
  const title = role === "merchant" ? "Merchant assistant" : "Shopper assistant";

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => setVisibleViewport({ height: viewport.height, top: viewport.offsetTop });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      setVisibleViewport(null);
    };
  }, [open]);

  if (!session?.access_token) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!open && (
        <Button
          type="button"
          className="fixed z-[60] right-4 bottom-24 md:bottom-6 h-12 rounded-full shadow-lg gap-2 px-4"
          onClick={() => setOpen(true)}
        >
          <MessageSquare className="h-4 w-4" />
          Assistant
        </Button>
      )}
      <SheetContent
        side="right"
        className="flex w-full min-h-0 flex-col gap-3 overflow-hidden p-4 sm:max-w-md"
        style={visibleViewport ? { height: `${visibleViewport.height}px`, top: `${visibleViewport.top}px`, bottom: "auto" } : undefined}
      >
        <SheetHeader className="space-y-0 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <LoyalSparkConcierge role={role} title={title} className="min-h-0 flex-1 border-0 shadow-none" />
      </SheetContent>
    </Sheet>
  );
}
