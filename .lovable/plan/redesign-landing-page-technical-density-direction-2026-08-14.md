# Redesign: Landing page — "Technical density" direction

Studio-grade rework of the marketing home page (`/`) in the chosen direction: asymmetric hero, real product surface, dense but calm grids. Palette stays exactly as today (purple `#8b45f0`, orange `#ff8a3d`, lavender `#faf8ff`, ink `#1f1433`) — only composition, typography rhythm and depth change.

## What changes visually

**Hero (LandingHero)**
- Two-column 12-col grid: copy on the left (7 cols), a realistic product card on the right (5 cols). No more fully centered block.
- Solid ink headline with the second line in primary purple — the gradient-text effect is dropped.
- "Built on Base Network" becomes a compact pill at the top of the copy column instead of a footer badge.
- Right column: a wallet-preview card — total balance, two merchant token rows with amounts, and a "Base Mainnet / Verified" footer strip. Static presentation mock, no live data.
- Decorative floating blur blobs replaced by a very faint dot grid and one soft accent glow.

**How It Works**
- Section header on the left with a rule extending to the right; three equal cards on a white surface with subtle borders instead of clay shadows.
- Numbered chips (purple / orange / purple) keep the existing three steps and copy meaning.

**Built for Everyone**
- Two large rounded panels: merchants on ink, shoppers on purple, each with a 3-item feature list and its own CTA.
- Merchant panel surfaces the AI-agent/MCP angle — a real differentiator versus UDS.

**Global craft**
- Restrained shadow scale replaces the puffy clay look on landing sections only (`bg-gradient-card` clay stays untouched everywhere else in the app).
- Consistent 8pt spacing rhythm and a tighter type scale.

## Copy rules

Product copy stays truthful to what exists today. The prototype's invented lines about yield, staking vaults, APY and "appreciating assets" are **not** used — Round-Up / DeFi yield stays frozen per project rules. Wording keeps the current promises: earn tokens at checkout, redeem for rewards, trade P2P, agents automate.

## Mobile

Same content stacked: copy → product card → steps → dual panels. Hero type steps down, panels go full width, CTAs full width. No horizontal scroll at 375px.

## Technical notes

- Files touched: `src/components/landing/LandingHero.tsx`, `LandingHowItWorks`/steps section, the dual-audience section, `LandingCTA.tsx`, plus a new `src/components/landing/HeroProductCard.tsx`.
- All colors go through existing semantic tokens (`--primary`, `--secondary`, `--background`, `--foreground`); no hex literals in components. If the direction needs a new surface or dot-grid token, it is added to `src/index.css` + `tailwind.config.ts`.
- Typography: keep Inter (already loaded) with tightened tracking/weights rather than adding a new font — avoids an extra font request and keeps the brand.
- Dark mode is verified for every new surface.
- Landing only. No routing, backend, RLS, or product logic changes. Nothing in the merchant/customer portals is touched.

## Out of scope for now

Portal (in-app) UX rework, pricing/guide/api-docs pages. Those can follow the same language in a second pass once you approve the landing.
