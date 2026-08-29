import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SiteHeader from "@/components/SiteHeader";

const RefundPage = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to home
      </Link>
      <h1 className="text-4xl font-bold mt-6 mb-2">Refund Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: August 29, 2026</p>

      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6 space-y-6">
          <section>
            <Badge variant="secondary" className="mb-2">7-day money-back guarantee</Badge>
            <h2 className="text-xl font-semibold">1. Subscription refunds</h2>
            <p>
              Loyal Spark has two separate paid products — see{" "}
              <Link to="/pricing" className="text-primary hover:underline">Pricing</Link>:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Merchant portal</strong> — Starter ($39/mo), Growth ($79/mo),
                Scale ($149/mo)
              </li>
              <li>
                <strong>AI agents (API + MCP)</strong> — Pro ($49/mo), Enterprise ($129/mo)
              </li>
            </ul>
            <p>
              If you are not satisfied with a paid subscription (monthly or annual billing)
              on either product, you can request a refund within{" "}
              <strong>7 days of the USDC payment transaction</strong>. We refund{" "}
              <strong>80% of the amount paid in USDC</strong> to the wallet that paid. The
              20% retained covers onchain gas, facilitator fees and processing.
            </p>
            <p>
              <strong>Free tiers and trials</strong> involve no USDC charge — there is
              nothing to refund. Agent Free ($0) is always free. New merchants receive a
              45-day <strong>Growth</strong> trial and new agent owners a 45-day{" "}
              <strong>Pro</strong> trial at no cost until you upgrade to a paid plan.
            </p>
            <p>
              After 7 days, subscriptions are non-refundable but you keep access until
              the period you paid for ends (monthly or annual term).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Pay-per-call x402 and MPP payments</h2>
            <p>
              Single x402 or MPP micro-payments (typically $0.001 – $0.05) are{" "}
              <strong>non-refundable</strong> once the underlying API call returns
              successfully. If a paid request fails on our side (5xx error or facilitator
              timeout), reach out and we will refund the failed call manually.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Onchain transactions</h2>
            <p>
              Loyalty token mints, transfers, redemptions and marketplace trades happen
              on the Base blockchain and are <strong>irreversible</strong>. We cannot
              refund or reverse them — please double-check before confirming any
              transaction in your wallet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. How to request a refund</h2>
            <ol className="list-decimal pl-6">
              <li>
                Email{" "}
                <a href="mailto:admin@loyalspark.online" className="text-primary hover:underline">
                  admin@loyalspark.online
                </a>{" "}
                from your account email or with your wallet address.
              </li>
              <li>
                Include the transaction hash or subscription ID and a short reason.
              </li>
              <li>We respond within 3 business days.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Chargebacks</h2>
            <p>
              All payments are in USDC on Base — chargebacks are not technically possible
              on the blockchain. Please always contact us first; we want to make it
              right.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default RefundPage;
