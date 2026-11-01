import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";

test.describe("sales as owner", { tag: ["@sales", "@regression"] }, () => {
  asRole("owner");
  test.describe.configure({ mode: "serial" });

  const supplierName = unique("Sales Supplier");
  const coffeeName = unique("Sales Coffee");
  const lotCode = unique("LOT-S").replace(/\s/g, "-");
  const productName = unique("Benguet Blend");
  const materialName = unique("250 g pouch");
  const fgLot = unique("FG-S").replace(/\s/g, "-");
  const customerName = unique("Cafe Customer");
  let orderUrl = "";

  test("prepare five 250 g bags and a customer", async ({
    page,
    masterData,
    purchases,
    roasting,
    packaging,
  }) => {
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
    await roasting.startNew();
    await roasting.fillInput(0, lotCode, "1500");
    await roasting.createDraft();
    const batchNumber = (await page.getByTestId("page-title").textContent())!.trim();
    await roasting.start();
    await roasting.complete({ roastedG: "1260", durationS: "600", firstCrackS: "480", lpg: "40" });

    await masterData.goto("/packaging/materials");
    await masterData.openCreate();
    await masterData.fill({ name: materialName, standard_unit_cost: "8" });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
    await page.goto("/inventory/adjustments/new");
    const line = page.getByTestId("adjustment-line").first();
    await line.getByTestId("select-lot").selectOption({ label: materialName });
    await line.getByTestId("select-direction").selectOption("increase");
    await line.getByTestId("input-quantity").fill("50");
    await line.locator('input[id$=".unit_cost"]').fill("8");
    await page.getByTestId("adjustment-submit").click();
    await page.waitForURL(/\/inventory\/adjustments\/[0-9a-f-]+$/);

    await page.goto("/products");
    await page.getByTestId("create-button").click();
    await page.getByTestId("input-name").fill(productName);
    await page.getByTestId("form-submit").click();
    await page.waitForURL(/\/products\/[0-9a-f-]+$/);
    await page.getByTestId("add-variant").click();
    await page.getByTestId("input-sku").fill(unique("BB-250").replace(/\s/g, "-"));
    await page.getByTestId("input-variant-name").fill("250 g bag");
    await page.getByTestId("input-net-weight").fill("250");
    await page.getByTestId("input-selling-price").fill("350");
    await page.getByTestId(`bom-${materialName.replace(/\s+/g, "-").toLowerCase()}`).fill("1");
    await page.getByTestId("variant-submit").click();
    await expect(page.getByTestId("variant-row")).toHaveCount(1);

    await packaging.startNew();
    await packaging.selectBatch(0, batchNumber, "1250");
    await packaging.selectOutput(0, productName, "5", fgLot);
    await packaging.createDraft();
    await packaging.complete();

    await masterData.goto("/customers");
    await masterData.openCreate();
    await masterData.fill({ name: customerName, phone: "0917 123 4567" });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
  });

  test("order three bags, confirm, fulfil, verify stock of two, record payment", async ({
    page,
    sales,
  }) => {
    await sales.startNew();
    await sales.selectCustomer(customerName);
    await sales.addItem(0, productName, "3");
    await expect(
      page.getByTestId("order-item-row").first().getByTestId("input-unit-price"),
    ).toHaveValue("350.00");
    await expect(page.getByTestId("order-total")).toContainText("1,050.00");
    await sales.createDraft();
    orderUrl = page.url();
    await expect(page.getByTestId("status-badge").first()).toHaveText("Draft");
    await sales.confirm();
    await expect(page.getByTestId("order-items")).toContainText(`${fgLot} ×3`);
    await sales.fulfilAll();
    await expect(page.getByTestId("stat-fulfilled")).toContainText("3 / 3");
    await expect(page.getByTestId("fulfillment-cost").first()).toContainText("149.8667");
    await expect(page.getByTestId("stat-cogs")).toContainText("449.60"); // 3 × ₱149.8667 (₱749.33 session / 5 bags)

    await page.goto("/inventory/finished");
    await page.getByTestId("search-input").fill(fgLot);
    await page.getByTestId("search-input").press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === fgLot);
    const row = page.getByTestId("data-row").filter({ hasText: fgLot }).first();
    await expect(row.getByTestId("available-units")).toHaveAttribute("data-units", "2");

    await page.goto(orderUrl);
    await sales.recordPayment("1050", "GC-E2E-1");
    await expect(
      page.getByTestId("status-badge").filter({ hasText: "Paid" }).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId("status-badge").filter({ hasText: "Completed" }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("stat-paid")).toContainText("1,050.00");
    await expect(page.getByTestId("payment")).toHaveCount(1);
  });

  test("customer history and printable document", async ({ page, masterData }) => {
    await masterData.goto("/customers");
    await masterData.searchFor(customerName);
    await masterData.rowByName(customerName).getByTestId("row-name").click();
    await page.waitForURL(/\/customers\/[0-9a-f-]+$/);
    await expect(page.getByTestId("customer-orders")).toContainText("1");
    await expect(page.getByTestId("customer-revenue")).toContainText("1,050.00");
    await expect(page.getByTestId("customer-outstanding")).toContainText("0.00");
    await expect(page.getByTestId("orders-table")).toContainText("Completed");
    await page.goto(`${orderUrl}/print`);
    await expect(page.getByTestId("print-document")).toContainText(customerName);
    await expect(page.getByTestId("print-document")).toContainText("1,050.00");
    await page.goto("/sales/history");
    await expect(page.getByTestId("history-row").first()).toContainText(fgLot);
  });
});

test.describe("sales as viewer", { tag: ["@security", "@sales"] }, () => {
  asRole("viewer");
  test("viewer can see sales but cannot create orders", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByTestId("create-button")).toHaveCount(0);
    await page.goto("/sales/new");
    await expect(page.getByTestId("access-denied")).toBeVisible();
  });
});
