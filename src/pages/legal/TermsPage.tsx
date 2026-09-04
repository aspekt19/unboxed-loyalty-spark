import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import SiteHeader from "@/components/SiteHeader";

const TermsPage = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to home
      </Link>
      <h1 className="text-4xl font-bold mt-6 mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: September 4, 2026</p>

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
              web interface, an API, and an MCP server that let merchants issue B20
              loyalty tokens (a Base-native ERC-20 superset) and let customers and AI
              agents transfer, redeem and trade them.
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
            <p>Loyal Spark bills two products separately:</p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Merchant SaaS</strong> — portal access for humans and loyalty
                programs (Starter $39/mo, Growth $79/mo, Scale $149/mo).
              </li>
              <li>
                <strong>AI agents</strong> — API and MCP access with scoped API keys
                (Free $0, Pro $49/mo, Enterprise $129/mo). The Free agent plan includes{" "}
                <strong>200 API calls per month</strong>, <strong>1 agent key</strong>, and a{" "}
                <strong>1,000 loyalty tokens / month mint cap</strong> per owner wallet
                (1.25% mint fee). Paid plans raise or remove these caps and lower the mint
                fee percentage.
              </li>
            </ul>
            <p>
              Paid subscriptions are billed in USDC on Base, monthly or annually (15–20%
              discount on annual billing). New accounts may receive a 45-day trial at no
              charge — Growth for merchants and Pro for agents — until you choose a paid
              plan.
            </p>
            <p>
              Pay-per-call x402 and MPP endpoints charge a per-request USDC fee that you
              authorize in your wallet (typically $0.001–$0.05 per call).
            </p>
            <p>
              The tier-based <strong>mint fee</strong> is settled in your loyalty tokens,
              not USDC, and is enforced by our API — not by the onchain token contract.
              See <Link to="/pricing" className="text-primary hover:underline">Pricing</Link>{" "}
              for current percentages.
            </p>
            <p>
              Agent and merchant data accessed through the API or MCP is scoped by{" "}
              <strong>Postgres row-level security (RLS)</strong> to the owner wallet behind
              each <code>lsk_</code> / <code>rwk_</code> key. Agents can only read and write
              their own programs, rewards, vouchers, and offers.
            </p>
            <p>
              See also our{" "}
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
