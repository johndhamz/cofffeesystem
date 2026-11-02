import ExcelJS from "exceljs";
import { test, expect, asRole } from "../fixtures/test";
import { ownerApi, businessId, productWithVariant } from "../fixtures/api";
import { unique } from "../fixtures/users";

/** Sales → Import history: template download, upload, preview, commit, and the result in history. */
test.describe("sales history import @sales @regression", () => {
  asRole("owner");

  test("imports an Excel file of past sales as fulfilled, paid, backdated orders", async ({
    page,
    request,
  }, testInfo) => {
    const api = await ownerApi();
    const bid = await businessId(api);
    const product = await productWithVariant(api, bid, {
      name: unique("Imported Blend"),
      price: 350,
    });
    const customerName = unique("Import Customer");

    const tpl = await request.get("/templates/sales-history-template.xlsx");
    expect(tpl.ok()).toBe(true);
    expect(tpl.headers()["content-type"]).toContain("spreadsheet");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await tpl.body()) as unknown as ArrayBuffer);
    // keep the template's header row, replace the example rows with ours
    const template = wb.getWorksheet("Sales")!;
    const headers = (template.getRow(1).values as string[]).slice(1);
    wb.removeWorksheet(template.id);
    const sheet = wb.addWorksheet("Sales");
    sheet.addRow(headers);
    const rows = [
      [
        "2026-09-03",
        "Walk-in",
        "",
        product.productName,
        product.sku,
        2,
        350,
        180,
        "yes",
        "cash",
        "",
        "",
      ],
      [
        "2026-09-03",
        "Walk-in",
        "",
        product.productName,
        product.sku,
        1,
        350,
        180,
        "yes",
        "cash",
        "",
        "",
      ],
      [
        "2026-09-05",
        "Walk-in",
        customerName,
        product.productName,
        product.sku,
        4,
        320,
        180,
        "no",
        "bank_transfer",
        "INV-7",
        "terms",
      ],
      [
        "2026-09-06",
        "Nope Channel",
        "",
        product.productName,
        product.sku,
        1,
        320,
        180,
        "yes",
        "cash",
        "",
        "",
      ],
    ];
    rows.forEach((r) => sheet.addRow(r));
    const file = testInfo.outputPath("history.xlsx");
    await wb.xlsx.writeFile(file);

    await page.goto("/sales");
    await page.getByTestId("import-link").click();
    await expect(page).toHaveURL(/\/sales\/import/);
    await page.getByTestId("import-file").setInputFiles(file);
    await page.getByTestId("import-check").click();
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expect(page.getByTestId("import-row-errors")).toContainText(
      'Row 5: Channel "Nope Channel" not found',
    );
    await expect(page.getByTestId("import-commit")).toBeDisabled();

    // fix the file and check again
    sheet.spliceRows(5, 1);
    expect(sheet.rowCount).toBe(4);
    await wb.xlsx.writeFile(file);
    await page.getByTestId("import-file").setInputFiles(file);
    await page.getByTestId("import-check").click();
    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expect(page.getByTestId("import-row-errors")).toHaveCount(0);
    await expect(page.getByTestId("import-orders").getByRole("row")).toHaveCount(3); // header + 2 orders
    await expect(page.getByTestId("import-opening")).toContainText("7");
    await page.getByTestId("import-commit").click();
    await expect(page.getByTestId("import-result")).toContainText("2 orders created");

    // the orders exist, fulfilled and backdated, with the customer created
    const { data: orders } = await api
      .from("sales_order_summary_view")
      .select("status, payment_status, total_amount")
      .eq("customer_name", customerName);
    expect(orders).toEqual([{ status: "fulfilled", payment_status: "unpaid", total_amount: 1280 }]);
    const { data: avail } = await api
      .from("variant_availability_view")
      .select("on_hand")
      .eq("variant_id", product.variantId)
      .single();
    expect(avail?.on_hand).toBe(0);
  });
});
