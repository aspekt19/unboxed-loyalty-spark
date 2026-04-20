import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPage = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to home
      </Link>
      <h1 className="text-4xl font-bold mt-6 mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: April 20, 2026</p>

      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold">1. What we collect</h2>
            <ul className="list-disc pl-6">
              <li>
                <strong>Wallet address.</strong> Required to sign in (SIWE) and to attribute
                onchain activity.
              </li>
              <li>
                <strong>Email or phone (optional).</strong> Only if you sign in via Privy
                with email/phone, or if a merchant asks for it for receipts.
              </li>
              <li>
                <strong>Profile data you enter.</strong> Business name, logo, location,
                description.
              </li>
              <li>
                <strong>Onchain data.</strong> Public by design — token balances, mints,
                transfers, redemptions on Base.
              </li>
              <li>
                <strong>Technical logs.</strong> IP address, user agent, request
                timestamps for rate limiting and abuse prevention.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. What we do NOT collect</h2>
            <ul className="list-disc pl-6">
              <li>Private keys or seed phrases — ever.</li>
              <li>Behavioural tracking via third-party advertising cookies.</li>
              <li>Sensitive personal data (race, health, biometrics, etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How we use it</h2>
            <ul className="list-disc pl-6">
              <li>Authenticate you and protect your account.</li>
              <li>Run loyalty programs you participate in.</li>
              <li>Show analytics to merchants about their own customers.</li>
              <li>Respond to support requests.</li>
            </ul>
            <p>
              Merchant analytics show <strong>masked PII</strong> (e.g. <code>j***@gmail.com</code>) to other
              merchants — full email/phone is visible only to the merchant who owns the
              relationship.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Third-party processors</h2>
            <ul className="list-disc pl-6">
              <li><strong>Privy</strong> — authentication & embedded wallets.</li>
              <li><strong>Supabase</strong> — database, edge functions, storage.</li>
              <li><strong>Coinbase CDP</strong> — agent MPC wallets, x402 facilitator.</li>
              <li><strong>Base / Ethereum</strong> — public blockchain.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Your rights</h2>
            <p>
              You can request deletion of your off-chain profile data at any time by
              emailing us. <strong>Onchain data cannot be deleted</strong> — it lives on
              the public Base blockchain.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Cookies</h2>
            <p>
              We use only essential cookies/local storage required for authentication and
              theme preferences. No advertising or cross-site tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Contact</h2>
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

export default PrivacyPage;
