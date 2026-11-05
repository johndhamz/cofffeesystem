import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";
import {
  businessId,
  completedRoast,
  customer,
  ownerApi,
  packagedBags,
  productWithVariant,
  receivedGreenLot,
} from "../fixtures/api";

/** STEP 4 — negative testing through the UI; the database-level cases live in the integration suites. */
test.describe("negative paths", { tag: ["@regression", "@security"] }, () => {
  asRole("owner");

  test("roast: insufficient green stock, invalid weights", async ({ page, roasting }) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const lot = await receivedGreenLot(api, bid, { grams: 1000 });
    await roasting.startNew();
    await roasting.fillInput(0, lot.lotCode, "0");
    await roasting.submit().click();
    await expect(
      page
        .getByTestId("roast-input-row")
        .first()
        .getByTestId("error-inputs.0.input_weight_g")
        .or(page.getByText("Weight must be greater than zero")),
    ).toBeVisible();
    await roasting.fillInput(0, lot.lotCode, "1500");
    await expect(page.getByTestId("stock-warning")).toBeVisible();
    await roasting.createDraft();
    await page.getByTestId("complete-link").click();
    await page.getByTestId("input-roasted-weight").fill("2000"); // > green
    await page.getByTestId("input-duration").fill("10:00");
    await page.getByTestId("complete-submit").click();
    await expect(
      page
        .getByTestId("form-error")
        .or(page.getByText(/cannot exceed/))
        .first(),
    ).toBeVisible();
    await page.getByTestId("input-roasted-weight").fill("1260");
    await page.getByTestId("complete-submit").click();
    await expect(page.getByTestId("form-error")).toContainText(
      /INSUFFICIENT_STOCK|insufficient|on hand/i,
    );
    await expect(page.getByTestId("completion-form")).toBeVisible(); // still a draft, nothing moved
  });

  test("packaging: insufficient roasted stock and non-integer quantity", async ({
    page,
    packaging,
  }) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const lot = await receivedGreenLot(api, bid);
    const roast = await completedRoast(api, bid, lot.lotId, lot.locationId, 1500, 1260);
    const prod = await productWithVariant(api, bid);
    await packaging.startNew();
    await packaging.selectBatch(0, roast.batchNumber, "1250");
    await packaging.selectOutput(0, prod.productName, "6"); // needs 1500 g > 1250 g input
    await expect(page.getByTestId("shortfall-warning")).toBeVisible();
    await packaging.submit().click();
    await expect(page.getByTestId("form-error")).toContainText(/less than the coffee required/);
    await packaging.selectOutput(0, prod.productName, "2.5");
    await packaging.submit().click();
    await expect(page.getByText("Quantity must be a whole number")).toBeVisible();
  });

  test("sales: insufficient finished stock blocks confirmation; invalid prices rejected", async ({
    page,
    sales,
  }) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const lot = await receivedGreenLot(api, bid);
    const roast = await completedRoast(api, bid, lot.lotId, lot.locationId);
    const prod = await productWithVariant(api, bid);
    await packagedBags(api, bid, roast.batchId, prod.variantId, lot.locationId, 2);
    await sales.startNew();
    await sales.addItem(0, prod.productName, "3");
    await expect(page.getByTestId("stock-warning")).toBeVisible();
    await page.getByTestId("order-item-row").first().getByTestId("input-unit-price").fill("-5");
    await expect(page.getByTestId("error-boundary")).toHaveCount(0); // regression: negative price used to crash the page
    await sales.submit().click();
    await expect(
      page.getByText(/Enter an amount with up to 2 decimal places/).first(),
    ).toBeVisible();
    await page.getByTestId("order-item-row").first().getByTestId("input-unit-price").fill("350");
    await sales.createDraft();
    await page.getByTestId("confirm-order-button").click();
    await page.getByTestId("confirm-order-dialog-confirm").click();
    await expect(page.getByText(/INSUFFICIENT_STOCK|only 2 unit/).first()).toBeVisible();
    await expect(page.getByTestId("status-badge").first()).toHaveText("Draft");
  });

  test("duplicate submissions: a double-clicked payment records once", async ({ page, sales }) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const lot = await receivedGreenLot(api, bid);
    const roast = await completedRoast(api, bid, lot.lotId, lot.locationId);
    const prod = await productWithVariant(api, bid);
    await packagedBags(api, bid, roast.batchId, prod.variantId, lot.locationId, 5);
    const cust = await customer(api, bid);
    await sales.startNew();
    await sales.selectCustomer(cust.name);
    await sales.addItem(0, prod.productName, "1");
    await sales.createDraft();
    await sales.confirm();
    await page.getByTestId("record-payment-button").click();
    await page.getByTestId("input-payment-amount").fill("350");
    await page.getByTestId("input-payment-reference").fill(unique("DUP"));
    const submit = page.getByTestId("payment-submit");
    // two clicks in the same tick: the second must be a no-op (same idempotency key / dialog closed)
    await Promise.allSettled([
      submit.click({ noWaitAfter: true }),
      submit.click({ noWaitAfter: true, force: true, timeout: 2_000 }),
    ]);
    await page.getByTestId("payment-dialog").waitFor({ state: "hidden" });
    await expect(page.getByTestId("payment")).toHaveCount(1);
    await expect(page.getByTestId("stat-paid")).toContainText("350.00");
  });

  test("missing references: an order needs an item; a purchase needs a supplier", async ({
    page,
    purchases,
  }) => {
    await purchases.startNew();
    await purchases.submit().click();
    await expect(page.getByText("Invalid id").first()).toBeVisible();
    await page.goto("/sales/new");
    await page.getByTestId("order-submit").click();
    await expect(page.getByText("Invalid id").first()).toBeVisible();
  });

  test("invalid attachment is rejected server-side", async ({ page, roasting }) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const lot = await receivedGreenLot(api, bid);
    await roasting.startNew();
    await roasting.fillInput(0, lot.lotCode, "500");
    await roasting.createDraft();
    await page.getByTestId("attachment-input").setInputFiles({
      name: "malware.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("MZ not really"),
    });
    await page.getByTestId("attachment-upload").click();
    await expect(page.getByText(/Upload failed|mime type|not allowed/i)).toBeVisible();
    await expect(page.getByTestId("attachment-row")).toHaveCount(0);
    await page.getByTestId("attachment-input").setInputFiles({
      name: "curve.png",
      mimeType: "image/png",
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await page.getByTestId("attachment-upload").click();
    await expect(page.getByTestId("attachment-row")).toHaveCount(1);
  });

  test("interrupted request: reloading after submit shows exactly one document", async ({
    page,
    purchases,
  }) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const lot = await receivedGreenLot(api, bid);
    await purchases.startNew();
    await purchases.supplier().selectOption({ label: lot.supplierName });
    await purchases.fillItem(0, { coffee: lot.coffeeName, quantityKg: "1", unitCost: "400" });
    await purchases.submit().click();
    await page.waitForURL(/\/purchases\/[0-9a-f-]+$/);
    await page.reload();
    await expect(page.getByTestId("status-badge").first()).toHaveText("Draft");
    const { data } = await api
      .from("purchase_orders")
      .select("id")
      .eq(
        "supplier_id",
        (await api.from("suppliers").select("id").eq("name", lot.supplierName).single()).data!.id,
      );
    expect(data).toHaveLength(2); // the API-created one + this draft, no duplicates
  });
});

test.describe("session expiry", { tag: ["@security"] }, () => {
  asRole("owner");
  test("a cleared session is redirected to login on the next navigation and action", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("page-title")).toBeVisible();
    await context.clearCookies();
    await page.goto("/sales/new");
    await expect(page).toHaveURL(/\/login\?next=%2Fsales%2Fnew/);
  });
});
