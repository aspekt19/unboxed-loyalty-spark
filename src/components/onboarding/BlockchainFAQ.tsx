import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export const BlockchainFAQ = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <CardTitle>Blockchain & Web3 FAQ</CardTitle>
        </div>
        <CardDescription>
          Common questions about blockchain loyalty tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="what-is-blockchain">
            <AccordionTrigger>What is blockchain?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Blockchain is a digital ledger technology that records transactions across multiple
              computers. Think of it as a permanent, transparent record book that everyone can see
              but no one can alter. In Loyal Spark, the blockchain ensures all loyalty token
              transactions are transparent and verifiable.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="what-is-wallet">
            <AccordionTrigger>Do I need a crypto wallet?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              No! You can sign in with just your email or a passkey. A secure wallet is created
              for you automatically behind the scenes via Coinbase Smart Wallet. If you already
              have a Web3 wallet (like MetaMask or Coinbase Wallet), you can use that too.
              Either way, you control your rewards directly.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="what-are-tokens">
            <AccordionTrigger>What are loyalty tokens?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Loyalty tokens are digital rewards stored on the blockchain. Unlike traditional
              points that only exist in a company's database, these tokens are real assets you own.
              You can hold them, trade them, or use them for rewards - and no one can take them
              away from you.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="why-blockchain">
            <AccordionTrigger>Why use blockchain for loyalty?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Blockchain provides several advantages:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>True ownership:</strong> You own your tokens, not the company</li>
                <li><strong>Transparency:</strong> All transactions are visible and verifiable</li>
                <li><strong>Liquidity:</strong> Tokens can be traded on decentralized exchanges</li>
                <li><strong>Security:</strong> Cryptographically secured and tamper-proof</li>
                <li><strong>Interoperability:</strong> Use tokens across different platforms</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="how-to-start">
            <AccordionTrigger>How do I get started?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <strong>For Customers:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Click "Sign In" (use email, passkey, or an existing wallet)</li>
                <li>Choose "I'm a Shopper"</li>
                <li>Show your QR code to merchants to earn tokens</li>
                <li>Browse rewards and redeem with your tokens</li>
              </ol>
              <strong className="block mt-4">For Merchants:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Sign in with email, passkey, or wallet</li>
                <li>Choose "I'm a Business"</li>
                <li>Create your loyalty program and deploy your token</li>
                <li>Scan customer QR codes to issue tokens</li>
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="is-it-safe">
            <AccordionTrigger>Is it safe and secure?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Yes! Blockchain technology is extremely secure. Your tokens are protected by
              cryptography - the same technology that secures cryptocurrencies worth trillions of
              dollars. Only you have access to your wallet and tokens. However, remember:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>If using a traditional wallet, keep your password/seed phrase safe</li>
                <li>Never share your private keys with anyone</li>
                <li>Email/passkey accounts are secured by Coinbase Smart Wallet</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="gas-fees">
            <AccordionTrigger>Do I need to pay gas fees?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              For customers: No! All token transactions are sponsored by merchants. You don't need
              to pay anything to receive or redeem tokens.
              <br /><br />
              For merchants: Yes, there are small blockchain fees (gas fees) when you deploy your
              token contract and issue rewards. These fees go to the blockchain network, not to
              Loyal Spark. We use Base network which has very low fees (typically less than $0.01
              per transaction).
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="can-i-sell">
            <AccordionTrigger>Can I sell or trade my tokens?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Yes! Because your loyalty tokens are real blockchain assets, you can:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Trade them on decentralized exchanges (DEX)</li>
                <li>Send them to friends or family</li>
                <li>Hold them for future use</li>
                <li>Sell them for other cryptocurrencies</li>
              </ul>
              This gives your loyalty rewards real, tangible value beyond just merchant discounts.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="what-happens-business">
            <AccordionTrigger>What if the business closes?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              This is a key advantage of blockchain! Even if a business closes, your tokens still
              exist on the blockchain and remain in your wallet. While you may not be able to
              redeem them with that specific merchant anymore, you still own them and could
              potentially:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Trade them on DEX exchanges</li>
                <li>Hold them as digital collectibles</li>
                <li>Use them if another business accepts them</li>
              </ul>
              This is very different from traditional loyalty points which disappear when a company
              closes.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="network">
            <AccordionTrigger>Which blockchain network do you use?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              We use Base Sepolia (testnet) for development and Base (mainnet) for production. Base
              is an Ethereum Layer 2 network that offers:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Very low transaction fees (typically under $0.01)</li>
                <li>Fast transaction speeds (1-2 seconds)</li>
                <li>Full Ethereum security and compatibility</li>
                <li>Backed by Coinbase</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
