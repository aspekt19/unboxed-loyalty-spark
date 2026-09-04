import { expect, test } from "@playwright/test";

/**
 * Guards the public marketing/API surface against regressions of the claims we
 * corrected after the September 2026 audit:
 *  - no permanent "free for businesses" promise (trial + paid plans only)
 *  - no "audit history" / "verified protocol" security claim
 *  - no DEX / "tradeable" wording for the frozen marketplace modules
 *  - discovery files stay in sync (16 skill guides, Free = 1,000 tokens/month)
 */

const FORBIDDEN_COPY = [
  /free for (customers and )?businesses/i,
  /audit history/i,
  /any DEX/i,
  /watch them grow/i,
  /enterprise-grade security/i,
];

async function bodyText(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Routes are lazy-loaded behind Suspense; wait until the shell has rendered copy.
  await expect
    .poll(async () => (await page.locator("body").innerText()).trim().length, { timeout: 30_000 })
    .toBeGreaterThan(200);
  await page.waitForLoadState("networkidle").catch(() => {});
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

for (const path of ["/", "/pricing", "/for-agents", "/api-docs"]) {
  test(`no retracted marketing claims on ${path}`, async ({ page }) => {
    const text = await bodyText(page, path);
    expect(text.length).toBeGreaterThan(200);
    for (const pattern of FORBIDDEN_COPY) {
      expect(text, `"${pattern}" must not appear on ${path}`).not.toMatch(pattern);
    }
  });
}

test("pricing states the Free agent plan limits exactly once", async ({ page }) => {
  const text = await bodyText(page, "/pricing");
  expect(text).toMatch(/1 API key/i);
  // "Multiple agents" is a Pro feature and must be rendered as excluded on Free.
  expect(text).not.toMatch(/free[^.]{0,80}multiple agents/i);
});

test("skills index advertises 16 guides", async ({ request }) => {
  const res = await request.get("/.well-known/skills/index.md");
  expect(res.status()).toBe(200);
  const md = await res.text();
  const guides = md.match(/\b(0\d|1[0-5])-[a-z0-9-]+\.md/g) ?? [];
  expect(new Set(guides).size).toBeGreaterThanOrEqual(16);
});

test("agent.json and x402 discovery agree on plan limits and skills", async ({ request }) => {
  const agent = await (await request.get("/.well-known/agent.json")).json();
  expect(agent.skills?.guide_count).toBe(16);

  const x402 = await (await request.get("/.well-known/x402.json")).json();
  expect(x402.skills?.guide_count).toBe(16);
  expect(x402.planLimits?.free?.max_mint_amount_monthly).toBe(1000);
  expect(x402.accessControl?.model).toBe("row-level-security");
});

test("openapi.json documents plan limits and RLS scoping", async ({ request }) => {
  const spec = await (await request.get("/openapi.json")).json();
  expect(spec.info["x-skills"].guide_count).toBe(16);
  expect(spec.info["x-plan-limits"].free.max_mint_amount_monthly).toBe(1000);
  expect(spec.info["x-access-control"].model).toBe("row-level-security");
  expect(spec.servers.every((s: { url: string }) => !s.url.includes("supabase.co"))).toBe(true);
});
