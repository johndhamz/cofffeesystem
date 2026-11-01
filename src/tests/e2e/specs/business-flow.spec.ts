import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";
import { businessId, dashboardMetrics, ownerApi } from "../fixtures/api";

/**
 * STEP 3 — the complete business scenario, end to end through the UI, with every value reconciled.
 * Tags: @regression @smoke-chain
 */
test.describe(
  "complete business flow",
  { tag: ["@regression", "@inventory", "@production", "@packaging", "@sales", "@finance"] },
  () => {
    asRole("owner");
    test.describe.configure({ mode: "serial" });

    const supplierName = unique("Kalinga Growers Coop");
    const coffeeName = unique("Sultan Kudarat Natural Robusta");
    const lotCode = unique("SKR-LOT").replace(/\s/g, "-");
    const productName = unique("Sultan Kudarat Robusta");
    const bagName = unique("250 g valve bag");
    const fgLot = unique("SKR-FG").replace(/\s/g, "-");
    const customerName = unique("Brew Lab Cafe");
    let batchNumber = "";
    let orderUrl = "";
    let before: Record<string, number>;

    test.beforeAll(async () => {
      const api = await ownerApi();
      before = await dashboardMetrics(api, await businessId(api));
    });

    test("1–2: supplier and green coffee exist", async ({ masterData }) => {
      await masterData.goto("/settings/suppliers");
      await masterData.openCreate();
      await masterData.fill({ name: supplierName, contact_person: "Ana", phone: "0917 000 1111" });
      await masterData.submit().click();
      await expect(masterData.dialog()).toBeHidden();
      await masterData.goto("/green-coffee");
      await masterData.openCreate();
      await masterData.fill({
        name: coffeeName,
        country: "Philippines",
        region: "Sultan Kudarat",
        variety: "Robusta",
        processing_method: "Natural",
      });
      await masterData.submit().click();
      await expect(masterData.dialog()).toBeHidden();
      await masterData.searchFor(coffeeName);
      await expect(masterData.rowByName(coffeeName)).toContainText("Natural");
    });

    test("3–4: purchase 10 kg and receive 10,000 g", async ({ page, purchases, inventory }) => {
      await purchases.startNew();
      await purchases.supplier().selectOption({ label: supplierName });
      await purchases.fillItem(0, { coffee: coffeeName, quantityKg: "10", unitCost: "450" });
      await expect(page.getByTestId("po-total")).toContainText("4,500.00");
      await purchases.submit().click();
      await page.waitForURL(/\/purchases\/[0-9a-f-]+$/);
      await purchases.confirmOrder();
      await purchases.receive({ quantityKg: "10", lotCode });
      await expect(page.getByTestId("receipt-item").first()).toContainText("10 kg");
      await inventory.goto();
      await inventory.filterByLot(lotCode);
      expect(await inventory.availableGramsForLot(lotCode)).toBe(10_000);
      await expect(inventory.rowByLot(lotCode)).toContainText("450.00");
    });

    test("5–9: roast 1,500 g → 1,260 g; green 8,500 g; roasted 1,260 g", async ({
      page,
      roasting,
      inventory,
    }) => {
      await roasting.startNew();
      await roasting.fillInput(0, lotCode, "1500");
      await roasting.createDraft();
      batchNumber = (await page.getByTestId("page-title").textContent())!.trim();
      await roasting.start();
      await roasting.complete({
        roastedG: "1260",
        durationS: "600",
        firstCrackS: "480",
        lpg: "40",
      });
      await expect(page.getByTestId("stat-loss")).toContainText("16% / 84%");
      await expect(page.getByTestId("stat-cost")).toContainText("567.46"); // (₱675 + ₱40) / 1.26 kg
      await inventory.goto();
      await inventory.filterByLot(lotCode);
      expect(await inventory.availableGramsForLot(lotCode)).toBe(8_500);
      await page.goto("/inventory/roasted");
      await expect(
        page
          .getByTestId("roasted-row")
          .filter({ hasText: batchNumber })
          .first()
          .getByTestId("roasted-on-hand"),
      ).toHaveAttribute("data-grams", "1260");
    });

    test("10–12: package five 250 g bags; roasted 10 g left; five units", async ({
      page,
      masterData,
      packaging,
    }) => {
      await masterData.goto("/packaging/materials");
      await masterData.openCreate();
      await masterData.fill({ name: bagName, standard_unit_cost: "8" });
      await masterData.submit().click();
      await expect(masterData.dialog()).toBeHidden();
      await page.goto("/inventory/adjustments/new");
      const line = page.getByTestId("adjustment-line").first();
      await line.getByTestId("select-lot").selectOption({ label: bagName });
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
      await page.getByTestId("input-sku").fill(unique("SKR-250").replace(/\s/g, "-"));
      await page.getByTestId("input-variant-name").fill("250 g bag");
      await page.getByTestId("input-net-weight").fill("250");
      await page.getByTestId("input-selling-price").fill("350");
      await page.getByTestId(`bom-${bagName.replace(/\s+/g, "-").toLowerCase()}`).fill("1");
      await page.getByTestId("variant-submit").click();
      await expect(page.getByTestId("variant-row")).toHaveCount(1);
      await packaging.startNew();
      await packaging.selectBatch(0, batchNumber, "1250");
      await packaging.selectOutput(0, productName, "5", fgLot);
      await expect(page.getByTestId("remaining-weight")).toHaveText("0 g");
      await page.getByTestId("input-labor").fill("50");
      await packaging.createDraft();
      await packaging.complete();
      await expect(page.getByTestId("stat-units")).toContainText("5");
      await expect(page.getByTestId("stat-cost")).toContainText("799.33"); // 715 × 1250/1260 + 40 + 50
      await page.goto("/inventory/roasted");
      await expect(
        page
          .getByTestId("roasted-row")
          .filter({ hasText: batchNumber })
          .first()
          .getByTestId("roasted-on-hand"),
      ).toHaveAttribute("data-grams", "10");
      await page.goto("/inventory/finished");
      await page.getByTestId("search-input").fill(fgLot);
      await page.getByTestId("search-input").press("Enter");
      await page.waitForURL((u) => u.searchParams.get("q") === fgLot);
      await expect(
        page
          .getByTestId("data-row")
          .filter({ hasText: fgLot })
          .first()
          .getByTestId("available-units"),
      ).toHaveAttribute("data-units", "5");
    });

    test("13–17: customer, sell three bags, fulfil, two units left, record payment", async ({
      page,
      masterData,
      sales,
    }) => {
      await masterData.goto("/customers");
      await masterData.openCreate();
      await masterData.fill({ name: customerName, phone: "0917 222 3333" });
      await masterData.submit().click();
      await expect(masterData.dialog()).toBeHidden();
      await sales.startNew();
      await sales.selectCustomer(customerName);
      await sales.addItem(0, productName, "3");
      await expect(page.getByTestId("order-total")).toContainText("1,050.00");
      await sales.createDraft();
      orderUrl = page.url();
      await sales.confirm();
      await sales.fulfilAll();
      await expect(page.getByTestId("stat-fulfilled")).toContainText("3 / 3");
      await page.goto("/inventory/finished");
      await page.getByTestId("search-input").fill(fgLot);
      await page.getByTestId("search-input").press("Enter");
      await page.waitForURL((u) => u.searchParams.get("q") === fgLot);
      await expect(
        page
          .getByTestId("data-row")
          .filter({ hasText: fgLot })
          .first()
          .getByTestId("available-units"),
      ).toHaveAttribute("data-units", "2");
      await page.goto(orderUrl);
      await sales.recordPayment("1050", unique("GC").replace(/\s/g, "-"));
      await expect(
        page.getByTestId("status-badge").filter({ hasText: "Completed" }).first(),
      ).toBeVisible();
    });

    test("18–21: revenue ₱1,050, COGS ₱479.60, gross profit ₱570.40; dashboard deltas reconcile", async ({
      page,
    }) => {
      await page.goto(orderUrl);
      await expect(page.getByTestId("stat-total")).toContainText("1,050.00");
      await expect(page.getByTestId("stat-cogs")).toContainText("479.60"); // 3 × ₱159.866667
      await expect(page.getByTestId("stat-cogs")).toContainText("570.40");
      const api = await ownerApi();
      const after = await dashboardMetrics(api, await businessId(api));
      expect(Math.round((after.net_sales - before.net_sales) * 100)).toBe(105_000);
      expect(Math.round((after.cogs - before.cogs) * 100)).toBe(47_960);
      expect(Math.round((after.gross_profit - before.gross_profit) * 100)).toBe(57_040);
      expect(after.units_sold - before.units_sold).toBe(3);
      expect(after.roasted_output_g - before.roasted_output_g).toBe(1260);
      // stock deltas: green −1,500 g; roasted +10 g; finished +2 units
      expect(after.green_stock_g - before.green_stock_g).toBe(8_500);
      expect(after.roasted_stock_g - before.roasted_stock_g).toBe(10);
      expect(after.finished_units - before.finished_units).toBe(2);
      await page.goto("/dashboard?from=2026-01-01&to=2026-12-31");
      await expect(page.getByTestId("metric-net-sales-value")).toContainText("₱");
      await page.goto("/reports/profitability?from=2026-01-01&to=2026-12-31");
      await expect(page.getByTestId("p-net-sales-value")).toContainText("₱");
    });

    test("22–23: movement history and source-lot traceability", async ({ page, inventory }) => {
      await inventory.goto();
      await inventory.filterByLot(lotCode);
      await inventory.gotoLotMovements(lotCode);
      await expect(page.locator('[data-movement-type="receipt"]')).toHaveCount(1);
      await expect(page.locator('[data-movement-type="roast_consume"]')).toHaveCount(1);
      await page.goto("/inventory/finished?stock=all");
      await page.getByTestId("search-input").fill(fgLot);
      await page.getByTestId("search-input").press("Enter");
      await page.waitForURL((u) => u.searchParams.get("q") === fgLot);
      await page
        .getByTestId("data-row")
        .filter({ hasText: fgLot })
        .first()
        .getByTestId("row-name")
        .click();
      await page.waitForURL(/\/inventory\/finished\/[0-9a-f-]+$/);
      await expect(page.getByTestId("lot-unit-cost")).toContainText("159.87");
      await expect(page.getByTestId("lineage-batch").first()).toContainText(batchNumber);
      await expect(page.getByTestId("lineage-green-lot").first()).toContainText(lotCode);
      await expect(page.getByTestId("lineage-green-lot").first()).toContainText(coffeeName);
      await expect(page.locator('[data-movement-type="pack_output"]')).toHaveCount(1);
      await expect(page.locator('[data-movement-type="sale"]')).toHaveCount(1);
      await page.goto("/inventory");
      await expect(page.getByTestId("reconciliation-alert")).toHaveCount(0);
    });
  },
);
