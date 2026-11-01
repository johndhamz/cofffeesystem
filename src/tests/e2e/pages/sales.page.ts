import type { Page } from "@playwright/test";

export class SalesPage {
  constructor(private readonly page: Page) {}

  readonly form = () => this.page.getByTestId("order-form");
  readonly submit = () => this.page.getByTestId("order-submit");

  async startNew() {
    await this.page.goto("/sales/new");
    await this.form().waitFor();
  }

  async selectCustomer(nameContains: string) {
    const select = this.page.getByTestId("select-customer");
    const value = await select
      .locator("option")
      .filter({ hasText: nameContains })
      .first()
      .getAttribute("value");
    await select.selectOption(value!);
  }

  async addItem(index: number, productContains: string, quantity: string) {
    const row = this.page.getByTestId("order-item-row").nth(index);
    const select = row.getByTestId("select-variant");
    const value = await select
      .locator("option")
      .filter({ hasText: productContains })
      .first()
      .getAttribute("value");
    await select.selectOption(value!);
    await row.getByTestId("input-quantity").fill(quantity);
  }

  async createDraft() {
    await this.submit().click();
    await this.page.waitForURL(/\/sales\/[0-9a-f-]+$/);
  }

  async confirm() {
    await this.page.getByTestId("confirm-order-button").click();
    await this.page.getByTestId("confirm-order-dialog-confirm").click();
    await this.page.getByTestId("status-badge").filter({ hasText: "Reserved" }).first().waitFor();
  }

  async fulfilAll() {
    await this.page.getByTestId("fulfill-link").click();
    await this.page.getByTestId("fulfillment-form").waitFor();
    await this.page.getByTestId("fulfil-submit").click();
    await this.page.waitForURL(/\/sales\/[0-9a-f-]+$/);
    await this.page.getByTestId("status-badge").filter({ hasText: "Fulfilled" }).first().waitFor();
  }

  async recordPayment(amount: string, reference: string) {
    await this.page.getByTestId("record-payment-button").click();
    await this.page.getByTestId("payment-dialog").waitFor();
    await this.page.getByTestId("input-payment-amount").fill(amount);
    await this.page.getByTestId("input-payment-reference").fill(reference);
    await this.page.getByTestId("payment-submit").click();
    await this.page.getByTestId("payment-dialog").waitFor({ state: "hidden" });
  }
}
