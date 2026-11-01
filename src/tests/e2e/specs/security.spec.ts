import { test, expect, asRole } from "../fixtures/test";
import { businessId, ownerApi, receivedGreenLot } from "../fixtures/api";
import { unique } from "../fixtures/users";

/** STEP 7 — browser-level security checks (RLS/permission depth is covered in integration/security.test.ts). */
test.describe("security headers and secrets", { tag: ["@security", "@smoke"] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("responses carry hardening headers and no server secrets reach the browser", async ({
    request,
  }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    const html = await res.text();
    expect(html).not.toContain("service_role");
    expect(html).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "never-matches");
  });

  test("protected pages, API exports and manifest behave for anonymous users", async ({
    request,
  }) => {
    for (const p of ["/dashboard", "/inventory", "/sales", "/reports/profitability", "/settings"]) {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status(), p).toBe(307);
      expect(res.headers()["location"]).toContain("/login");
    }
    expect((await request.get("/api/health")).status()).toBe(200);
    expect((await request.get("/api/reports/sales/csv", { maxRedirects: 0 })).status()).toBe(307);
  });
});

test.describe("role boundaries in the UI", { tag: ["@security", "@regression"] }, () => {
  asRole("viewer");

  test("viewer sees read-only screens everywhere and cannot reach mutation routes", async ({
    page,
  }) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const lot = await receivedGreenLot(api, bid);
    for (const [path, testId] of [
      ["/settings/suppliers", "create-button"],
      ["/green-coffee", "create-button"],
      ["/purchases", "create-button"],
      ["/roasting", "create-button"],
      ["/packaging", "create-button"],
      ["/products", "create-button"],
      ["/sales", "create-button"],
      ["/expenses", "create-button"],
      ["/inventory", "new-adjustment-button"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByTestId(testId), path).toHaveCount(0);
    }
    for (const path of [
      "/purchases/new",
      "/roasting/new",
      "/packaging/new",
      "/sales/new",
      "/inventory/adjustments/new",
      "/reports/profitability",
    ]) {
      await page.goto(path);
      await expect(page.getByTestId("access-denied"), path).toBeVisible();
    }
    await page.goto(`/inventory/lots/${lot.lotId}`);
    await expect(page.getByTestId("edit-lot-button")).toHaveCount(0);
    await page.goto("/settings");
    await expect(page.getByTestId("settings-readonly")).toBeVisible();
  });
});

test.describe("input hardening", { tag: ["@security"] }, () => {
  asRole("owner");

  test("search terms with filter syntax and script tags are handled safely", async ({
    page,
    masterData,
  }) => {
    const nasty = `<script>alert(1)</script>,id.not.is.null)("`;
    await masterData.goto("/settings/suppliers");
    await masterData.search().fill(nasty);
    await masterData.search().press("Enter");
    await page.waitForURL((u) => (u.searchParams.get("q") ?? "").includes("script"));
    await expect(page.getByTestId("error-boundary")).toHaveCount(0);
    await expect(
      page.getByTestId("empty-state").or(page.getByTestId("suppliers-table")),
    ).toBeVisible();
    // rendered as text, not executed
    expect(await page.locator("script", { hasText: "alert(1)" }).count()).toBe(0);
    await masterData.openCreate();
    await masterData.fill({ name: `${unique("Supplier")} ${nasty}`.slice(0, 100) });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
    await expect(page.locator("script", { hasText: "alert(1)" })).toHaveCount(0);
  });
});
