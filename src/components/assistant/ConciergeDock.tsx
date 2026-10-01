import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LoyalSparkConcierge } from "@/components/assistant/LoyalSparkConcierge";

type Role = "merchant" | "shopper";

/** Always-visible chat launcher. Tab placement was too easy to miss. */
export function ConciergeDock({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const title = role === "merchant" ? "Merchant assistant" : "Shopper assistant";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        className="fixed z-[60] right-4 bottom-24 md:bottom-6 h-12 rounded-full shadow-lg gap-2 px-4"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-4 w-4" />
        Assistant
      </Button>
      <SheetContent side="right" className="flex w-full flex-col gap-3 p-4 sm:max-w-md">
        <SheetHeader className="space-y-0 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <LoyalSparkConcierge role={role} title={title} className="h-[min(78vh,640px)] border-0 shadow-none" />
      </SheetContent>
    </Sheet>
  );
}
