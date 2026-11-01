import type { Page } from "@playwright/test";

export class InventoryPage {
  constructor(private readonly page: Page) {}

  readonly rows = () => this.page.getByTestId("data-row");
  readonly rowByLot = (lotCode: string) =>
    this.rows().filter({ has: this.page.getByTestId("lot-code").filter({ hasText: lotCode }) });
  readonly lotFilter = () => this.page.getByTestId("filter-lot");
  readonly movementRows = () => this.page.getByTestId("movement-row");

  // adjustment form
  readonly adjustmentForm = () => this.page.getByTestId("adjustment-form");
  readonly adjustmentSubmit = () => this.page.getByTestId("adjustment-submit");

  async goto() {
    await this.page.goto("/inventory");
    await this.page.getByTestId("page-title").waitFor();
  }

  async filterByLot(lotCode: string) {
    await this.lotFilter().fill(lotCode);
    await this.lotFilter().press("Enter");
    await this.page.waitForURL((url) => url.searchParams.get("lot") === lotCode);
  }

  async availableGramsForLot(lotCode: string): Promise<number> {
    const cell = this.rowByLot(lotCode).getByTestId("available-g");
    await cell.waitFor();
    return Number(await cell.getAttribute("data-grams"));
  }

  async gotoLotMovements(lotCode: string) {
    await this.rowByLot(lotCode).getByTestId("row-name").click();
    await this.page.waitForURL("**/inventory/lots/**");
  }

  async postAdjustment(values: {
    lotLabel: string;
    direction: "increase" | "decrease";
    grams: string;
    notes?: string;
  }) {
    await this.page.goto("/inventory/adjustments/new");
    await this.adjustmentForm().waitFor();
    const line = this.page.getByTestId("adjustment-line").first();
    await line.getByTestId("select-lot").selectOption({ label: values.lotLabel });
    await line.getByTestId("select-direction").selectOption(values.direction);
    await line.getByTestId("input-quantity").fill(values.grams);
    if (values.notes) await this.page.getByTestId("input-notes").fill(values.notes);
    await this.adjustmentSubmit().click();
    await this.page.waitForURL("**/inventory/adjustments/**");
  }
}
