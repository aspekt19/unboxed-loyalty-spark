import { test, expect } from "@playwright/test";

const FOOTER_LINKS = [
  { label: "Privacy", path: "/legal/privacy", heading: "Privacy Policy" },
  { label: "Terms", path: "/legal/terms", heading: "Terms of Service" },
  { label: "Refund", path: "/legal/refund", heading: "Refund Policy" },
  { label: "Trust", path: "/trust", heading: "Trust & Security at LoyalSpark" },
] as const;

test.describe("landing footer legal links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).toBeVisible();
  });

  test("footer contains all legal links", async ({ page }) => {
    const footer = page.locator("footer");
    for (const { label, path } of FOOTER_LINKS) {
      const link = footer.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", path);
    }
    await expect(
      footer.getByRole("link", { name: "admin@loyalspark.online" })
    ).toHaveAttribute("href", "mailto:admin@loyalspark.online");
  });

  for (const { label, path, heading } of FOOTER_LINKS) {
    test(`click "${label}" navigates to ${path}`, async ({ page }) => {
      await page
        .locator("footer")
        .getByRole("link", { name: label, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator("h1")).toHaveText(heading);
    });
  }
});

test.describe("/terms legacy redirect", () => {
  test("redirects to /legal/terms", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveURL(/\/legal\/terms$/);
    await expect(page.locator("h1")).toHaveText("Terms of Service");
  });
});
