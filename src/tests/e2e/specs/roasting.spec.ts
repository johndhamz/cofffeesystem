import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";

test.describe("roast production as owner", () => {
  asRole("owner");
  test.describe.configure({ mode: "serial" });

  const supplierName = unique("Roast Supplier");
  const coffeeName = unique("Roast Coffee");
  const lotCode = unique("LOT-R").replace(/\s/g, "-");
  let batchUrl = "";

  test("receive 10 kg of green coffee", async ({ page, masterData, purchases }) => {
    await masterData.goto("/settings/suppliers");
    await masterData.openCreate();
    await masterData.fill({ name: supplierName });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
    await masterData.goto("/green-coffee");
    await masterData.openCreate();
    await masterData.fill({ name: coffeeName, country: "Philippines" });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();

    await purchases.startNew();
    await purchases.supplier().selectOption({ label: supplierName });
    await purchases.fillItem(0, { coffee: coffeeName, quantityKg: "10", unitCost: "450" });
    await purchases.submit().click();
    await page.waitForURL(/\/purchases\/[0-9a-f-]+$/);
    await purchases.confirmOrder();
    await purchases.receive({ quantityKg: "10", lotCode });
  });

  test("create a 1.5 kg roast, record 1.26 kg output and complete it", async ({
    page,
    roasting,
  }) => {
    await roasting.startNew();
    await roasting.fillInput(0, lotCode, "1500");
    await expect(page.getByTestId("green-total")).toHaveText("1.5 kg");
    await expect(page.getByTestId("capacity-warning")).toHaveCount(0);
    await roasting.createDraft();
    batchUrl = page.url();
    await expect(page.getByTestId("status-badge").first()).toHaveText("Draft");
    await expect(page.getByTestId("stat-on-hand")).toContainText("0 g");

    await roasting.start();
    // manual measurements render the chart
    await page.getByTestId("m-elapsed").fill("0");
    await page.getByTestId("m-bt").fill("200");
    await page.getByTestId("m-et").fill("220");
    await page.getByTestId("m-add").click();
    await expect(page.getByTestId("measurement-row")).toHaveCount(1);
    await page.getByTestId("m-elapsed").fill("60");
    await page.getByTestId("m-bt").fill("110");
    await page.getByTestId("m-et").fill("190");
    await page.getByTestId("m-add").click();
    await expect(page.getByTestId("measurement-row")).toHaveCount(2);
    await expect(page.getByTestId("roast-chart")).toBeVisible();

    await roasting.complete({ roastedG: "1260", durationS: "600", firstCrackS: "480", lpg: "40" });
    await expect(page.getByTestId("stat-loss")).toContainText("16% / 84%");
    await expect(page.getByTestId("stat-dtr")).toContainText("20%");
    await expect(page.getByTestId("stat-roasted")).toContainText("1.26 kg");
    await expect(page.getByTestId("stat-on-hand")).toContainText("1.26 kg");
    await expect(page.getByTestId("roast-costs")).toContainText("LPG");
  });

  test("green stock is 8.5 kg, roasted stock is 1.26 kg and movements reconcile", async ({
    page,
    inventory,
  }) => {
    await inventory.goto();
    await expect(page.getByTestId("reconciliation-alert")).toHaveCount(0);
    await inventory.filterByLot(lotCode);
    expect(await inventory.availableGramsForLot(lotCode)).toBe(8500);
    await inventory.gotoLotMovements(lotCode);
    await expect(page.locator('[data-movement-type="roast_consume"]')).toHaveCount(1);

    await page.goto("/inventory/roasted");
    const row = page.getByTestId("roasted-row").filter({ hasText: coffeeName }).first();
    await expect(row.getByTestId("roasted-on-hand")).toHaveAttribute("data-grams", "1260");
    await expect(row).toContainText("567.46"); // (₱675 green + ₱40 LPG) / 1.26 kg

    await page.goto("/inventory/movements");
    await expect(page.locator('[data-movement-type="roast_output"]').first()).toBeVisible();
  });

  test("completed batch is immutable; void is available with a reason", async ({ page }) => {
    await page.goto(batchUrl);
    await expect(page.getByTestId("complete-link")).toHaveCount(0);
    await expect(page.getByTestId("edit-link")).toHaveCount(0);
    await expect(page.getByTestId("void-button")).toBeVisible();
  });
});

test.describe("roast production as viewer", () => {
  asRole("viewer");
  test("viewer can see roasts but cannot create them", async ({ page }) => {
    await page.goto("/roasting");
    await expect(page.getByTestId("page-title")).toHaveText("Roast Production");
    await expect(page.getByTestId("create-button")).toHaveCount(0);
    await page.goto("/roasting/new");
    await expect(page.getByTestId("access-denied")).toBeVisible();
  });
});
