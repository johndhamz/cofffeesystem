import type { Page } from "@playwright/test";

export class PackagingPage {
  constructor(private readonly page: Page) {}

  readonly form = () => this.page.getByTestId("packaging-form");
  readonly submit = () => this.page.getByTestId("packaging-submit");

  async startNew() {
    await this.page.goto("/packaging/new");
    await this.form().waitFor();
  }

  async selectBatch(index: number, labelContains: string, grams: string) {
    const row = this.page.getByTestId("input-row").nth(index);
    const select = row.getByTestId("select-batch");
    const value = await select
      .locator("option")
      .filter({ hasText: labelContains })
      .first()
      .getAttribute("value");
    await select.selectOption(value!);
    await row.getByTestId("input-weight").fill(grams);
  }

  async selectOutput(index: number, labelContains: string, quantity: string, lotCode?: string) {
    const row = this.page.getByTestId("output-row").nth(index);
    const select = row.getByTestId("select-variant");
    const value = await select
      .locator("option")
      .filter({ hasText: labelContains })
      .first()
      .getAttribute("value");
    await select.selectOption(value!);
    await row.getByTestId("input-quantity").fill(quantity);
    if (lotCode) await row.getByTestId("input-lot-code").fill(lotCode);
  }

  materialQty(materialName: string) {
    return this.page
      .locator(`[data-testid="material-row"][data-material="${materialName}"]`)
      .getByTestId("input-material-qty");
  }

  async createDraft() {
    await this.submit().click();
    await this.page.waitForURL(/\/packaging\/[0-9a-f-]+$/);
  }

  async complete() {
    await this.page.getByTestId("complete-button").click();
    await this.page.getByTestId("complete-dialog-confirm").click();
    await this.page.getByTestId("status-badge").filter({ hasText: "Completed" }).first().waitFor();
  }
}
