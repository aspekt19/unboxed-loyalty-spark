import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Mobile chat layout guard: on common iPhone / Android screens nothing in the
 * assistant window (messages, Clear, input, send) may be cut off at the screen edge,
 * and the input must not trigger iOS focus-zoom (font-size >= 16px).
 */
const DEVICES = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 13 mini", width: 360, height: 780 },
  { name: "iPhone 15", width: 393, height: 852 },
  { name: "iPhone 15 Pro Max", width: 430, height: 932 },
  { name: "Galaxy S8 / small Android", width: 360, height: 740 },
  { name: "Pixel 7", width: 412, height: 915 },
  { name: "Galaxy Fold (folded)", width: 320, height: 653 },
  { name: "Farcaster frame", width: 424, height: 695 },
];

const LONG_HASH = "0x" + "a1b2c3d4e5f6".repeat(6);
const SEED = [
  { role: "user", content: "что я потратил последним и на каком блоке" },
  {
    role: "assistant",
    content:
      `Последнее списание: 5 VENUS, блок 36123456.\nTx: https://basescan.org/tx/${LONG_HASH}\n` +
      "• Welcome perk — 5 CBE2C (есть 61.06)\n• SuperLongRewardNameWithoutAnySpacesThatMustWrapProperly — 300 SSR",
  },
  { role: "user", content: `Выбрать: Welcome perk ${LONG_HASH}` },
  {
    role: "assistant",
    content: "Подтвердите выпуск ваучера «Welcome perk». Списание: 5 VENUS. Баланс сейчас: 714527.22.",
  },
];

async function expectInside(el: Locator, width: number, label: string) {
  const box = await el.boundingBox();
  expect(box, `${label} should be rendered`).not.toBeNull();
  expect(box!.x, `${label} cut off on the left`).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width, `${label} cut off on the right`).toBeLessThanOrEqual(width + 0.5);
}

async function openChat(page: Page, role: "shopper" | "merchant") {
  await page.goto("/");
  await page.evaluate(
    ([key, seed]) => localStorage.setItem(key, seed),
    [`ls_concierge_${role}_anon`, JSON.stringify(SEED)],
  );
  await page.goto(`/__test/concierge-layout?role=${role}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText("Welcome perk").first()).toBeVisible();
  // Wait for the slide-in animation so we measure the final position.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  return dialog;
}

test.describe("Concierge chat fits phone screens", () => {
  test.beforeEach(({}, info) => {
    // Viewports are set per test; run once instead of in every configured project.
    test.skip(info.project.name !== "desktop", "device sizes are set inside the test");
  });

  for (const role of ["shopper", "merchant"] as const) {
    for (const d of DEVICES) {
      test(`${role} · ${d.name} ${d.width}x${d.height}`, async ({ page }) => {
        await page.setViewportSize({ width: d.width, height: d.height });
        const dialog = await openChat(page, role);

        await expectInside(dialog, d.width, "chat window");
        await expectInside(dialog.getByRole("button", { name: "Clear" }), d.width, "Clear button");
        await expectInside(dialog.getByRole("button", { name: "Close" }), d.width, "Close button");

        const input = dialog.getByRole("textbox");
        await expectInside(input, d.width, "message input");
        const sendBtn = dialog.locator("button:has(svg.lucide-send)");
        await expectInside(sendBtn, d.width, "send button");

        const fontSize = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(fontSize, "input font < 16px makes iOS zoom in on focus").toBeGreaterThanOrEqual(16);

        const bubbles = dialog.locator(".whitespace-pre-wrap");
        const count = await bubbles.count();
        expect(count).toBe(SEED.length);
        for (let i = 0; i < count; i++) {
          await bubbles.nth(i).scrollIntoViewIfNeeded();
          await expectInside(bubbles.nth(i), d.width, `message ${i + 1}`);
        }

        // No horizontal scrolling anywhere in the page or the chat.
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement.scrollWidth > window.innerWidth + 1;
          const inner = [...document.querySelectorAll('[role="dialog"] *')].some(
            (el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1 &&
              getComputedStyle(el).overflowX !== "hidden" && getComputedStyle(el).overflowX !== "clip" &&
              (el as HTMLElement).clientWidth > 0 && getComputedStyle(el).overflowX !== "visible",
          );
          return { doc, inner };
        });
        expect(overflow.doc, "page scrolls sideways").toBe(false);
        expect(overflow.inner, "an element inside the chat scrolls sideways").toBe(false);

        // Focusing the input must keep everything on screen (keyboard / zoom).
        await input.click();
        await expectInside(sendBtn, d.width, "send button after focus");
      });
    }
  }
});
