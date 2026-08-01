#!/usr/bin/env python3
"""Generate Sentient Foundation grant pack PDF (English)."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "Sentient_Foundation_Grant_Pack_EN.pdf"


class GrantPackPDF(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Loyal Spark | Sentient Foundation Grant Pack  |  Page {self.page_no()}", align="C")

    def section_title(self, title: str) -> None:
        self.ln(4)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(20, 40, 80)
        self.multi_cell(0, 8, title)
        self.ln(2)
        self.set_draw_color(20, 40, 80)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(4)
        self.set_x(self.l_margin)

    def body_text(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, f"  -  {text}")

    def numbered_heading(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(20, 40, 80)
        self.multi_cell(0, 7, text)
        self.ln(1)

    def table_row(self, label: str, desc: str, col1: float = 48, line_h: float = 5) -> None:
        col2 = self.epw - col1
        x0 = self.l_margin
        y0 = self.get_y()

        self.set_font("Helvetica", "B", 9)
        h_label = self.multi_cell(col1, line_h, label, border=0, dry_run=True, output="HEIGHT")
        self.set_font("Helvetica", "", 9)
        h_desc = self.multi_cell(col2, line_h, desc, border=0, dry_run=True, output="HEIGHT")
        row_h = max(h_label, h_desc)

        self.set_draw_color(180, 180, 180)
        self.rect(x0, y0, col1, row_h)
        self.rect(x0 + col1, y0, col2, row_h)

        self.set_xy(x0, y0)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(30, 30, 30)
        self.multi_cell(col1, line_h, label)

        self.set_xy(x0 + col1, y0)
        self.set_font("Helvetica", "", 9)
        self.multi_cell(col2, line_h, desc)

        self.set_y(y0 + row_h)

    def subsection_heading(self, text: str) -> None:
        self.ln(2)
        self.numbered_heading(text)


def build() -> None:
    pdf = GrantPackPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(20, 20, 20)

    # --- Page 1: Cover + one-pager ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(20, 40, 80)
    pdf.cell(0, 12, "Loyal Spark", ln=True)
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 7, "Loyalty-as-a-Service on Base - for merchants, customers, and AI agents")
    pdf.ln(3)
    pdf.set_font("Helvetica", "I", 10)
    pdf.multi_cell(0, 5, "Sentient Foundation Open Source AGI Grant Application - Supporting Document")
    pdf.ln(6)

    pdf.section_title("Executive summary")
    pdf.body_text(
        "Loyal Spark is Loyalty-as-a-Service (LaaS) on Base Mainnet. Merchants launch full onchain "
        "loyalty programs (ERC-20 token, minting, rewards, vouchers, CRM) through a web portal - "
        "without building Web3 infrastructure from scratch. Customers hold points in their own wallets. "
        "Developers and autonomous AI agents use the same backend via REST API and MCP (Model Context Protocol)."
    )
    pdf.body_text(
        "The codebase is MIT-licensed on GitHub. Smart contracts are live on Base. We expose open "
        "agent discovery (agent.json, OpenAPI, llms.txt, 13 Markdown skills) and support wallet-only "
        "agent registration (SIWE) with no dashboard required. Paid agent corridors use x402 micropayments (USDC on Base)."
    )

    pdf.section_title("At a glance")
    pdf.bullet("Live on Base Mainnet (Chain ID 8453)")
    pdf.bullet("Merchant portal + customer portal (Privy, SIWE, embedded wallets)")
    pdf.bullet("Agent API: 28 merchant REST (28 auth + 1 public) + 39 merchant MCP tools + 20 recipient MCP tools")
    pdf.bullet("x402 and MPP pay-per-call gateways")
    pdf.bullet("Capacitor native apps scaffolded (iOS / Android - grant target: store release)")
    pdf.bullet("Open source: github.com/aspekt19/unboxed-loyalty-spark (MIT)")

    # --- Page 2: Grant unlock ---
    pdf.add_page()
    pdf.section_title("What the $25,000 grant unlocks (4-6 months)")
    pdf.body_text(
        "Bootstrapping, I can keep mainnet running - but I cannot properly ship mobile apps, "
        "gasless UX, and open ecosystem work at the same time. This grant funds focused delivery:"
    )

    pdf.numbered_heading("1. App Store + Google Play")
    pdf.body_text(
        "Ship two Capacitor apps already scaffolded in the repo: Loyal Spark Business (merchants) "
        "and Loyal Spark (customers). Includes store assets, QA, review cycles, and dev account costs. "
        "Goal: loyalty that normal businesses can adopt as a mobile app, not only a website."
    )

    pdf.numbered_heading("2. Paymaster on Base (gasless transactions)")
    pdf.body_text(
        "Integrate a Paymaster so merchants and customers can mint, redeem, and transfer without "
        "holding ETH for gas. Wire through existing Privy + embedded wallet flows. Document the "
        "integration pattern in the MIT repo for other builders."
    )

    pdf.numbered_heading("3. Open agent layer")
    pdf.bullet("Expand the public skills bundle (merchant + holder end-to-end flows)")
    pdf.bullet("Reference MCP client configs (Cursor, Claude Desktop)")
    pdf.bullet("Polish SIWE agent registration (lsk_ API keys without UI)")
    pdf.bullet("x402 paid MCP/API examples; target 10+ unique external paying agent wallets")

    pdf.numbered_heading("4. Merchant pilots + live infra")
    pdf.bullet("Onboard 2-3 pilot merchants: deploy, mint, voucher - web + mobile + gasless")
    pdf.bullet("6 months production infra (RPC, Supabase, monitoring) so API/MCP stay up for integrators")

    pdf.ln(2)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        0,
        5,
        "Without the grant: mainnet stays up, but mobile, Paymaster, open docs, and merchant pilots stall - "
        "hurting anyone building on our open repo.",
    )

    # --- Page 3: Problem & Solution ---
    pdf.add_page()
    pdf.section_title("Problem")
    pdf.bullet("Legacy loyalty is closed: customers do not truly own points")
    pdf.bullet("Small businesses cannot afford custom Web3 builds or $99-499/mo legacy SaaS with revenue cuts")
    pdf.bullet("Going onchain often ends as a bare token with no vouchers, tiers, or operations")
    pdf.bullet("AI agents need the same economic layer - issue value, reward users, settle payments - but lack a ready stack")

    pdf.section_title("Solution - Loyalty-as-a-Service")
    pdf.body_text(
        "One platform on Base where any merchant can launch a full loyalty program in minutes - "
        "same infrastructure for everyone, not a custom build per brand."
    )
    pdf.ln(1)
    pdf.table_row("Merchants (portal)", "Deploy token, mint, rewards, vouchers, team, CRM")
    pdf.table_row("Customers (wallet)", "Own tokens, redeem, transfer, P2P escrow marketplace")
    pdf.table_row("Agents (API + MCP)", "Automate programs; pay per call via x402 or API keys (lsk_ / rwk_)")
    pdf.ln(4)

    pdf.section_title("Why now")
    pdf.bullet("Cheap L2 transactions and USDC on Base")
    pdf.bullet("Wallet abstraction (Privy) lowers the bar for non-crypto merchants and customers")
    pdf.bullet("MCP and x402 make agent-to-agent and pay-per-request commerce practical")
    pdf.bullet("Missing piece: an open, composable loyalty layer - not another one-off token per project")

    # --- Page 4: Product ---
    pdf.add_page()
    pdf.section_title("Product - live today")

    pdf.subsection_heading("Merchant flow")
    pdf.bullet("Deploy ERC-20 loyalty token via factory contract")
    pdf.bullet("Mint to email, phone, or wallet; vouchers, tiers, RFM, automation")
    pdf.bullet("Invite team (branches, employees) and AI agents (scoped API keys)")

    pdf.subsection_heading("Customer flow")
    pdf.bullet("Receive tokens to embedded or external wallet")
    pdf.bullet("Redeem rewards; trade on P2P escrow marketplace")
    pdf.bullet("Holder-side API (rwk_) and recipient MCP for agent-driven redemption")

    pdf.subsection_heading("Agent / developer surface")
    pdf.bullet("REST agent-api + loyalty-mcp (merchant) + recipient-loyalty-mcp (holder)")
    pdf.bullet("Autonomous registration: SIWE message, no web login required")
    pdf.bullet("CDP MPC server wallets for autonomous onchain operations")
    pdf.bullet("x402-gateway and mpp-gateway for pay-per-request access")

    pdf.section_title("What's open (MIT on GitHub)")
    pdf.bullet("Full application and Edge Function source")
    pdf.bullet("13 step-by-step agent skills (skills/loyal-spark/)")
    pdf.bullet("MCP examples, OpenAPI, agent.json, llms.txt")
    pdf.bullet("Contract ABIs, addresses, autonomous agent registration docs")
    pdf.body_text(
        "If we shut down tomorrow: merchants lose a working LaaS stack; customers lose live programs; "
        "developers lose running API/MCP and x402 endpoints. The repo can be forked, but production "
        "continuity would break."
    )

    # --- Page 5: Contracts + team ---
    pdf.add_page()
    pdf.section_title("Smart contracts - Base Mainnet")
    contracts = [
        ("LoyaltyTokenFactory", "0x5F3DdBa12580CFdc6016258774cCc19C4250dA80"),
        ("LoyalSparkERC20 (impl)", "0xe6BA426C9c51281B929a17444De02c65815E27C3"),
        ("LoyaltyTokenEscrow (P2P)", "0xA569C95AfC1BCF381c48BcF336ED9D2c014bcdDF"),
        ("Builder Code (ERC-8021)", "bc_wdmnog7m"),
    ]
    pdf.set_font("Helvetica", "", 9)
    for name, addr in contracts:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(55, 5, name)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(0, 5, addr, ln=True)

    pdf.ln(4)
    pdf.section_title("Team")
    pdf.body_text(
        "Solo founder - built Loyal Spark as LaaS on Base, then added the agent layer (REST, MCP, x402, "
        "CDP wallets) on the same backend. Shipped contracts and product on mainnet. Ships in public on GitHub (MIT)."
    )

    pdf.section_title("Grant request")
    pdf.bullet("Track: Grant (non-dilutive)")
    pdf.bullet("Amount: $25,000 USD")
    pdf.bullet("Focus: mobile store release, Paymaster, open agent docs, merchant pilots")

    # --- Page 6: Links ---
    pdf.add_page()
    pdf.section_title("Demo & trial links")

    links = [
        ("Website", "https://loyalspark.online"),
        ("Merchant portal", "https://loyalspark.online/merchant"),
        ("For agents / onboarding", "https://loyalspark.online/for-agents"),
        ("API documentation", "https://loyalspark.online/api-docs"),
        ("Agent manifest", "https://loyalspark.online/.well-known/agent.json"),
        ("GitHub (MIT)", "https://github.com/aspekt19/unboxed-loyalty-spark"),
    ]
    pdf.set_font("Helvetica", "", 10)
    for label, url in links:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(52, 6, label + ":")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(0, 80, 160)
        pdf.cell(0, 6, url, ln=True)
        pdf.set_text_color(30, 30, 30)

    pdf.ln(8)
    pdf.section_title("Contact")
    pdf.body_text("Website: https://loyalspark.online")
    pdf.body_text("Email: admin@loyalspark.online")
    pdf.body_text("X: https://x.com/Loyal_Spark")

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(0, 5, "(c) 2026 Loyal Spark. MIT-licensed open source. Built on Base.")

    pdf.output(str(OUT))
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
