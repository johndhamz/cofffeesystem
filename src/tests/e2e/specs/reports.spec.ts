import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";

test.describe("dashboard, expenses and reports as owner", () => {
  asRole("owner");
  test.describe.configure({ mode: "serial" });

  const expenseDesc = unique("LPG refill");

  test("dashboard shows financial metrics and charts, and filters by date", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("finance-metrics")).toBeVisible();
    await expect(page.getByTestId("metric-net-sales-value")).toContainText("₱");
    await expect(page.getByTestId("metric-green")).toBeVisible();
    await expect(page.getByTestId("metric-alerts")).toBeVisible();
    await page.getByTestId("date-range-filter").locator("#from").fill("2026-01-01");
    await expect(page).toHaveURL(/from=2026-01-01/);
    await expect(page.getByTestId("page-title").locator("..")).toContainText("2026-01-01");
    await expect(
      page.getByTestId("chart-weekly-roast").or(page.getByText("No data in this period.").first()),
    ).toBeVisible();
  });

  test("records an expense with a cost treatment", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByTestId("create-button").click();
    await page.getByTestId("expense-form-dialog").waitFor();
    await page.getByTestId("input-description").fill(expenseDesc);
    await page.getByTestId("input-amount").fill("1250.50");
    await page.getByTestId("select-treatment").selectOption("roast_production");
    await page.getByTestId("expense-submit").click();
    await page.waitForURL(/\/expenses\/[0-9a-f-]+$/);
    await expect(page.getByTestId("expense-amount")).toContainText("1,250.50");
    await expect(page.getByTestId("expense-treatment")).toContainText("Roast production");
    await expect(page.getByTestId("expense-treatment")).toContainText("inside inventory cost");
    await page.getByTestId("allocate-expense").click();
    await page.getByTestId("allocation-dialog").waitFor();
    const target = page.getByTestId("select-target");
    const count = await target.locator("option").count();
    if (count > 1) {
      await target.selectOption({ index: 1 });
      await page.getByTestId("input-alloc-amount").fill("250");
      await page.getByTestId("alloc-submit").click();
      await expect(page.getByTestId("allocation")).toHaveCount(1);
    }
  });

  test("opens the production and sales reports with filters", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByTestId("valuation")).toBeVisible();
    await page.getByTestId("report-card-production").click();
    await page.waitForURL(/\/reports\/production/);
    await expect(page.getByTestId("page-title")).toHaveText("Production report");
    await page.getByTestId("date-range-filter").locator("#from").fill("2026-01-01");
    await expect(page).toHaveURL(/from=2026-01-01/);
    await expect(
      page.getByTestId("report-totals").or(page.getByTestId("empty-state")),
    ).toBeVisible();

    await page.goto("/reports/sales?from=2026-01-01");
    await expect(page.getByTestId("page-title")).toHaveText("Sales report");
    await expect(page.getByTestId("report-filters")).toContainText("All channels");
    await page.getByTestId("filter-channel").selectOption({ label: "Walk-in" });
    await expect(page).toHaveURL(/channel=/);
    await expect(
      page.getByTestId("report-totals").or(page.getByTestId("empty-state")),
    ).toBeVisible();

    await page.goto("/reports/profitability?from=2026-01-01");
    await expect(page.getByTestId("profitability-summary")).toBeVisible();
    await expect(page.getByTestId("p-net-sales-value")).toContainText("₱");
    await expect(page.getByTestId("p-opex-value")).toContainText("₱");
  });

  test("exports CSV and PDF with server-side authorization", async ({ page, request }) => {
    await page.goto("/reports/sales?from=2026-01-01");
    const csvHref = await page.getByTestId("export-csv").getAttribute("href");
    const pdfHref = await page.getByTestId("export-pdf").getAttribute("href");
    expect(csvHref).toContain("/api/reports/sales/csv");
    const csv = await request.get(csvHref!);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain("Sales report");
    expect(text).toContain("Revenue,COGS,Gross profit");
    const pdf = await request.get(pdfHref!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const body = await pdf.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    const bad = await request.get("/api/reports/nonsense/csv");
    expect(bad.status()).toBe(404);
  });
});

test.describe("financial access as viewer", () => {
  asRole("viewer");
  test("viewer sees no financial metrics and cannot open or export financial reports", async ({
    page,
    request,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("finance-metrics")).toHaveCount(0);
    await expect(page.getByTestId("finance-hidden")).toBeVisible();
    await page.goto("/reports");
    await expect(
      page.locator('[data-testid="report-card-profitability"][data-locked="true"]'),
    ).toBeVisible();
    await page.goto("/reports/profitability");
    await expect(page.getByTestId("access-denied")).toBeVisible();
    await page.goto("/reports/production");
    await expect(page.getByTestId("page-title")).toHaveText("Production report");
    const res = await request.get("/api/reports/profitability/csv?from=2026-01-01&to=2026-12-31");
    expect(res.status()).toBe(403);
    const ok = await request.get("/api/reports/production/csv?from=2026-01-01&to=2026-12-31");
    expect(ok.status()).toBe(200);
  });
});

test.describe("exports when signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("export endpoints require a session", async ({ request }) => {
    // the auth proxy redirects anonymous requests to /login; the route itself also returns 401 without a session
    const res = await request.get("/api/reports/sales/csv", { maxRedirects: 0 });
    expect([307, 401]).toContain(res.status());
  });
});
