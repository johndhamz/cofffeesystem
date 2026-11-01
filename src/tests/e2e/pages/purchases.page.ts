import type { Page } from "@playwright/test";

export class PurchasesPage {
  constructor(private readonly page: Page) {}

  readonly createButton = () => this.page.getByTestId("create-button");
  readonly form = () => this.page.getByTestId("purchase-order-form");
  readonly supplier = () => this.page.getByTestId("select-supplier");
  readonly itemRows = () => this.page.getByTestId("po-item-row");
  readonly submit = () => this.page.getByTestId("po-submit");
  readonly confirmButton = () => this.page.getByTestId("confirm-po-button");
  readonly receiveButton = () => this.page.getByTestId("receive-button");
  readonly statusBadge = () =>
    this.page
      .getByTestId("page-title")
      .locator("..")
      .locator("..")
      .getByTestId("status-badge")
      .first();
  readonly receiptLinks = () => this.page.getByTestId("receipt-link");

  // receive form
  readonly receiveForm = () => this.page.getByTestId("receive-goods-form");
  readonly receiveSubmit = () => this.page.getByTestId("receive-submit");
  readonly receiptItemRows = () => this.page.getByTestId("receipt-item-row");

  async gotoList() {
    await this.page.goto("/purchases");
    await this.page.getByTestId("page-title").waitFor();
  }

  async startNew() {
    await this.page.goto("/purchases/new");
    await this.form().waitFor();
  }

  async fillItem(index: number, values: { coffee: string; quantityKg: string; unitCost: string }) {
    const row = this.itemRows().nth(index);
    await row.getByTestId("select-green-coffee").selectOption({ label: values.coffee });
    await row.getByTestId("input-quantity-kg").fill(values.quantityKg);
    await row.getByTestId("input-unit-cost").fill(values.unitCost);
  }

  async confirmOrder() {
    await this.confirmButton().click();
    await this.page.getByTestId("confirm-po-dialog-confirm").click();
    await this.page.getByTestId("status-badge").filter({ hasText: "Confirmed" }).first().waitFor();
  }

  async receive(values: { quantityKg: string; lotCode?: string }) {
    await this.receiveButton().click();
    await this.receiveForm().waitFor();
    const row = this.receiptItemRows().first();
    await row.getByTestId("input-received-kg").fill(values.quantityKg);
    if (values.lotCode) await row.getByTestId("input-lot-code").fill(values.lotCode);
    await this.receiveSubmit().click();
    await this.page.waitForURL("**/purchases/receipts/**");
  }
}
