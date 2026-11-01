import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";

test.describe("purchasing and inventory as owner", () => {
  asRole("owner");
  test.describe.configure({ mode: "serial" });

  const supplierName = unique("Flow Supplier");
  const coffeeName = unique("Flow Coffee");
  const lotA = unique("LOT-A").replace(/\s/g, "-");
  const lotB = unique("LOT-B").replace(/\s/g, "-");

  test("setup master data", async ({ masterData }) => {
    await masterData.goto("/settings/suppliers");
    await masterData.openCreate();
    await masterData.fill({ name: supplierName });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();

    await masterData.goto("/green-coffee");
    await masterData.openCreate();
    await masterData.fill({
      name: coffeeName,
      country: "Philippines",
      processing_method: "Washed",
    });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
  });

  test("create a purchase, receive 10 kg and verify stock increases by 10 kg", async ({
    page,
    purchases,
    inventory,
  }) => {
    await purchases.startNew();
    await purchases.supplier().selectOption({ label: supplierName });
    await purchases.fillItem(0, { coffee: coffeeName, quantityKg: "10", unitCost: "450" });
    await expect(page.getByTestId("po-total")).toContainText("4,500.00");
    await purchases.submit().click();
    await page.waitForURL(/\/purchases\/[0-9a-f-]+$/);
    await expect(page.getByTestId("status-badge").first()).toHaveText("Draft");
    await expect(page.getByTestId("no-receipts")).toBeVisible();

    await purchases.confirmOrder();
    await purchases.receive({ quantityKg: "10", lotCode: lotA });
    await expect(page.getByTestId("receipt-item")).toHaveCount(1);
    await expect(page.getByTestId("receipt-item").first()).toContainText(lotA);
    await expect(page.getByTestId("receipt-item").first()).toContainText("10 kg");

    await inventory.goto();
    await inventory.filterByLot(lotA);
    expect(await inventory.availableGramsForLot(lotA)).toBe(10_000);
    await expect(inventory.rowByLot(lotA)).toContainText("450.00");
  });

  test("a second purchase creates a separate lot with its own balance", async ({
    page,
    purchases,
    inventory,
  }) => {
    await purchases.startNew();
    await purchases.supplier().selectOption({ label: supplierName });
    await purchases.fillItem(0, { coffee: coffeeName, quantityKg: "5", unitCost: "600" });
    await purchases.submit().click();
    await page.waitForURL(/\/purchases\/[0-9a-f-]+$/);
    await purchases.confirmOrder();
    await purchases.receive({ quantityKg: "5", lotCode: lotB });

    await inventory.goto();
    await inventory.filterByLot(lotA);
    expect(await inventory.availableGramsForLot(lotA)).toBe(10_000);
    await inventory.filterByLot(lotB);
    expect(await inventory.availableGramsForLot(lotB)).toBe(5000);
    await expect(inventory.rowByLot(lotB)).toContainText("600.00");
  });

  test("an authorized adjustment reduces stock and appears in movement history", async ({
    page,
    inventory,
  }) => {
    await inventory.postAdjustment({
      lotLabel: `${coffeeName} · ${lotA}`,
      direction: "decrease",
      grams: "500",
      notes: "Cupping samples",
    });
    await expect(page.getByTestId("status-badge").first()).toHaveText("Posted");

    await inventory.goto();
    await inventory.filterByLot(lotA);
    expect(await inventory.availableGramsForLot(lotA)).toBe(9500);

    await inventory.gotoLotMovements(lotA);
    const rows = inventory.movementRows();
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Adjustment" }).first()).toContainText("500 g");
    await expect(page.locator('[data-movement-type="receipt"]')).toHaveCount(1);

    await page.goto("/inventory/movements");
    await expect(page.getByTestId("movement-row").first()).toBeVisible();
  });
});

test.describe("inventory as viewer", () => {
  asRole("viewer");

  test("viewer can see inventory but cannot adjust", async ({ page, inventory }) => {
    await inventory.goto();
    await expect(page.getByTestId("new-adjustment-button")).toHaveCount(0);
    await page.goto("/inventory/adjustments/new");
    await expect(page.getByTestId("access-denied")).toBeVisible();
  });
});
