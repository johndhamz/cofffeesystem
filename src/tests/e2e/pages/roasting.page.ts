import type { Page } from "@playwright/test";

export class RoastingPage {
  constructor(private readonly page: Page) {}

  readonly form = () => this.page.getByTestId("roast-batch-form");
  readonly submit = () => this.page.getByTestId("roast-submit");
  readonly startButton = () => this.page.getByTestId("start-button");
  readonly completeLink = () => this.page.getByTestId("complete-link");
  readonly completionForm = () => this.page.getByTestId("completion-form");
  readonly completeSubmit = () => this.page.getByTestId("complete-submit");

  async startNew() {
    await this.page.goto("/roasting/new");
    await this.form().waitFor();
  }

  async fillInput(index: number, lotLabelContains: string, grams: string) {
    const row = this.page.getByTestId("roast-input-row").nth(index);
    const select = row.getByTestId("select-lot");
    const optionValue = await select
      .locator("option")
      .filter({ hasText: lotLabelContains })
      .first()
      .getAttribute("value");
    await select.selectOption(optionValue!);
    await row.getByTestId("input-weight").fill(grams);
  }

  async createDraft() {
    await this.submit().click();
    await this.page.waitForURL(/\/roasting\/[0-9a-f-]+$/);
  }

  async start() {
    await this.startButton().click();
    await this.page.getByTestId("start-dialog-confirm").click();
    await this.page
      .getByTestId("status-badge")
      .filter({ hasText: "In progress" })
      .first()
      .waitFor();
  }

  async complete(values: {
    roastedG: string;
    durationS: string;
    firstCrackS?: string;
    lpg?: string;
  }) {
    await this.completeLink().click();
    await this.completionForm().waitFor();
    await this.page.getByTestId("input-roasted-weight").fill(values.roastedG);
    // the form takes minutes (m:ss); specs keep speaking in seconds
    const mmss = (sec: string) =>
      `${Math.floor(Number(sec) / 60)}:${String(Number(sec) % 60).padStart(2, "0")}`;
    await this.page.getByTestId("input-duration").fill(mmss(values.durationS));
    if (values.firstCrackS)
      await this.page.getByTestId("input-first-crack").fill(mmss(values.firstCrackS));
    if (values.lpg) await this.page.getByTestId("input-cost-amount").first().fill(values.lpg);
    await this.completeSubmit().click();
    await this.page.waitForURL(/\/roasting\/[0-9a-f-]+$/);
    await this.page.getByTestId("status-badge").filter({ hasText: "Completed" }).first().waitFor();
  }
}
