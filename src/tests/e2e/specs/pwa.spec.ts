import { test, expect } from "../fixtures/test";

/** Phase 7 — installable PWA assets and the offline fallback. */
test.describe("PWA @smoke", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("manifest, icons and service worker are served without authentication", async ({
    request,
  }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const json = (await manifest.json()) as {
      start_url: string;
      display: string;
      icons: { src: string; sizes: string }[];
    };
    expect(json.start_url).toBe("/dashboard");
    expect(json.display).toBe("standalone");
    expect(json.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of json.icons) {
      const res = await request.get(icon.src);
      expect(res.ok(), icon.src).toBe(true);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["content-type"]).toContain("javascript");
    expect(sw.headers()["cache-control"]).toContain("no-store");
    expect(await sw.text()).toContain("/offline");
  });

  test("the offline page renders and offers a retry", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByTestId("offline-page")).toBeVisible();
    await expect(page.getByTestId("offline-status")).toHaveText("Connection detected");
    await page.context().setOffline(true);
    await expect(page.getByTestId("offline-status")).toHaveText("Still offline");
    await page.context().setOffline(false);
    await expect(page.getByTestId("offline-status")).toHaveText("Connection detected");
  });

  test("home-screen metadata is present", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      /apple-touch-icon/,
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#1c1917");
  });
});
