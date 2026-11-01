import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";

test.describe("packaging as owner", () => {
  asRole("owner");
  test.describe.configure({ mode: "serial" });

  const supplierName = unique("Pack Supplier");
  const coffeeName = unique("Sultan Kudarat Robusta");
  const lotCode = unique("LOT-P").replace(/\s/g, "-");
  const productName = unique("Sultan Kudarat Robusta");
  const materialName = unique("250 g bag");
  const fgLot = unique("FG-E2E").replace(/\s/g, "-");
  let batchNumber = "";

  test("prepare: 1260 g roasted batch, a 250 g variant with a bag BOM, and 50 bags in stock", async ({
    page,
    masterData,
    purchases,
    roasting,
    inventory,
  }) => {
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
      processing_method: "Natural",
    });
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
    batchNumber = (await page.getByTestId("page-title").textContent())!.trim();
    await roasting.start();
    await roasting.complete({ roastedG: "1260", durationS: "600", firstCrackS: "480", lpg: "40" });

    // packaging material + stock via adjustment (50 pcs @ ₱8)
    await masterData.goto("/packaging/materials");
    await masterData.openCreate();
    await masterData.fill({ name: materialName, standard_unit_cost: "9" });
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
    void inventory;

    // product + variant with BOM
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
    await page.getByTestId(`bom-${materialName.replace(/\s+/g, "-").toLowerCase()}`).fill("1");
    await page.getByTestId("variant-submit").click();
    await expect(page.getByTestId("variant-row")).toHaveCount(1);
    await expect(page.getByTestId("variant-row").first()).toContainText("250 g");
  });

  test("package five 250 g bags from the 1260 g batch and complete", async ({
    page,
    packaging,
  }) => {
    await packaging.startNew();
    await packaging.selectBatch(0, batchNumber, "1250");
    await packaging.selectOutput(0, productName, "5", fgLot);
    await expect(page.getByTestId("required-weight")).toHaveText("1.25 kg");
    await expect(page.getByTestId("remaining-weight")).toHaveText("0 g");
    await expect(packaging.materialQty(materialName)).toHaveValue("5");
    await page.getByTestId("input-labor").fill("50");
    await expect(page.getByTestId("unit-cost-preview")).toContainText("/ unit");
    await packaging.createDraft();
    await expect(page.getByTestId("status-badge").first()).toHaveText("Draft");
    await packaging.complete();
    await expect(page.getByTestId("stat-units")).toContainText("5");
    // coffee ₱715 × 1250/1260 = ₱709.33 + bags 5 × ₱8 + labor ₱50 = ₱799.33
    await expect(page.getByTestId("stat-cost")).toContainText("799.33");
    await expect(page.getByTestId("output-unit-cost")).toContainText("159.8660");
    await expect(
      page.locator(`[data-testid="session-materials"] tr[data-material="${materialName}"]`),
    ).toContainText("5 pc");
  });

  test("10 g roasted remains, 5 units exist, materials decreased, lot links to the roast and unit cost is ₱159.87", async ({
    page,
  }) => {
    await page.goto("/inventory/roasted");
    const roastedRow = page.getByTestId("roasted-row").filter({ hasText: batchNumber }).first();
    await expect(roastedRow.getByTestId("roasted-on-hand")).toHaveAttribute("data-grams", "10");

    await page.goto("/inventory/materials");
    await expect(
      page
        .locator(`[data-testid="material-row"][data-material="${materialName}"]`)
        .getByTestId("material-on-hand"),
    ).toHaveAttribute("data-units", "45");

    await page.goto("/inventory/finished");
    await page.getByTestId("search-input").fill(fgLot);
    await page.getByTestId("search-input").press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === fgLot);
    const row = page.getByTestId("data-row").filter({ hasText: fgLot }).first();
    await expect(row.getByTestId("available-units")).toHaveAttribute("data-units", "5");
    await expect(row).toContainText("159.87");
    await row.getByTestId("row-name").click();
    await page.waitForURL(/\/inventory\/finished\/[0-9a-f-]+$/);
    await expect(page.getByTestId("lot-unit-cost")).toContainText("159.87");
    await expect(page.getByTestId("lineage-batch").first()).toContainText(batchNumber);
    await expect(page.getByTestId("lineage-green-lot").first()).toContainText(lotCode);
    await page.goto("/inventory");
    await expect(page.getByTestId("reconciliation-alert")).toHaveCount(0);
  });
});

test.describe("packaging as viewer", () => {
  asRole("viewer");
  test("viewer can see products and packaging but cannot create", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByTestId("create-button")).toHaveCount(0);
    await page.goto("/packaging/new");
    await expect(page.getByTestId("access-denied")).toBeVisible();
  });
});
