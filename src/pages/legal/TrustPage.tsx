import TrustSecurity from '@/components/landing/TrustSecurity';
import SiteHeader from '@/components/SiteHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Lock, Database, KeyRound, Mail, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TrustPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-14 space-y-12">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Trust Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Trust &amp; Security at LoyalSpark</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            This page is maintained by the LoyalSpark team to answer common security and privacy
            questions about the LoyalSpark application. It describes app-visible controls and current
            practices — it is not an independent certification.
          </p>
        </header>

        <TrustSecurity />

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" /> Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Sign-in is wallet-based via Sign-In With Ethereum (SIWE) or Privy. We never receive or store a password.</p>
              <p>AI-agent access uses scoped API keys (read, mint, manage, trade) that the owner can revoke at any time.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary" /> Access controls
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Every database table that holds user data is protected by row-level security policies enforced at the infrastructure level.</p>
              <p>Customer PII (email, phone, name) is never exposed to other users; merchants only see aggregated or masked data via server-side functions.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" /> Data we collect
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Wallet address, optional email/phone you provide, loyalty activity, and operational logs needed to run the service.</p>
              <p>Onchain transactions (mints, transfers, redemptions) are public by nature of the Base blockchain.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Subprocessors
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Hosting &amp; database: Lovable Cloud (managed Supabase). Auth/identity: Privy. Wallet infrastructure: Coinbase Developer Platform (MPC). Email delivery providers and analytics may be added — see our Privacy Policy for the current list.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Retention &amp; deletion
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>You can request deletion of your off-chain profile data at any time by contacting us. Onchain records cannot be deleted from the blockchain.</p>
              <p>Operational logs are retained only as long as needed for security and debugging.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-primary" /> Report a security issue
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Found a vulnerability? Please email <a className="text-primary underline" href="mailto:admin@loyalspark.online">admin@loyalspark.online</a> with details and reproduction steps. We respond within 72 hours and do not pursue good-faith researchers.</p>
            </CardContent>
          </Card>
        </section>

        <section className="text-center text-xs text-muted-foreground border-t border-border/50 pt-6">
          See also: <Link to="/legal/privacy" className="text-primary underline">Privacy Policy</Link>{' · '}
          <Link to="/legal/terms" className="text-primary underline">Terms of Service</Link>
        </section>
      </main>
    </>
  );
}
