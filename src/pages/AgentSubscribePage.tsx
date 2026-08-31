import { Link } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AgentPlanCheckout from "@/components/agents/AgentPlanCheckout";

export default function AgentSubscribePage() {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
              <Link to="/for-agents">
                <ArrowLeft className="h-4 w-4" /> Back to agents
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold">Agent subscription checkout</h1>
            <p className="text-sm text-muted-foreground">
              Pick a plan, confirm the summary and pay in USDC on Base directly from your wallet. Activation is
              automatic once the transaction is confirmed onchain.
            </p>
          </div>
          <AgentPlanCheckout />
        </main>
      </div>
    </PageTransition>
  );
}
