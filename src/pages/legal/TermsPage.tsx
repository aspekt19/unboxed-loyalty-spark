import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const TermsPage = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to home
      </Link>
      <h1 className="text-4xl font-bold mt-6 mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: April 20, 2026</p>

      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. Acceptance</h2>
            <p>
              By accessing or using Loyal Spark ("the Service"), available at
              loyalspark.online, you agree to these Terms of Service. If you do not
              agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. The Service</h2>
            <p>
              Loyal Spark is an open onchain loyalty protocol on Base L2. We provide a
              web interface, an API, and an MCP server that let merchants issue ERC-20
              loyalty tokens and let customers and AI agents transfer, redeem and trade
              them.
            </p>
            <p>
              The Service is provided "as is". You are responsible for the lawful use of
              your loyalty programs in your own jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Onchain transactions</h2>
            <p>
              All loyalty token transfers, mints, redemptions and marketplace trades are
              executed on the Base blockchain and are <strong>irreversible</strong>. We
              cannot reverse, cancel or refund onchain transactions once they are
              broadcast.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Subscriptions and fees</h2>
            <p>
              Paid plans are billed monthly in USDC on Base. Pay-per-call x402 endpoints
              charge a per-request fee that you authorize via EIP-3009 in your wallet.
              See <Link to="/pricing" className="text-primary hover:underline">Pricing</Link>{" "}
              and our{" "}
              <Link to="/legal/refund" className="text-primary hover:underline">
                Refund Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. AI agents</h2>
            <p>
              When you generate API keys or CDP wallets for autonomous agents, you remain
              fully responsible for their actions, including all onchain operations and
              any payments they trigger on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Prohibited use</h2>
            <ul className="list-disc pl-6">
              <li>No illegal goods, services or jurisdictions.</li>
              <li>No use as an investment scheme, security or unregistered fundraising.</li>
              <li>No abuse of API rate limits or bypass of payment requirements.</li>
              <li>No impersonation of other merchants or customers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Loyal Spark is not liable for any
              indirect, incidental or consequential damages, lost profits, or losses
              caused by smart contract bugs, blockchain congestion, third-party
              facilitators (Coinbase, Privy, Supabase) or your own private key
              management.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Beta features</h2>
            <p>
              Features explicitly marked as "Beta" or "Not live" (e.g. Round-Up, Token
              Exchange) are experimental and may change or be removed without notice. Do
              not rely on them for production.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Changes</h2>
            <p>
              We may update these Terms. Continued use after changes means you accept
              them. Material changes will be announced on the website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Contact</h2>
            <p>
              <a href="mailto:admin@loyalspark.online" className="text-primary hover:underline">
                admin@loyalspark.online
              </a>
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default TermsPage;
