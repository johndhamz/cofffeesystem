import type { Page } from "@playwright/test";

/** Page object for every master-data list (suppliers, green coffee, roasters, …). */
export class MasterDataPage {
  constructor(private readonly page: Page) {}

  readonly createButton = () => this.page.getByTestId("create-button").first();
  readonly dialog = () => this.page.locator('[data-testid$="-form-dialog"]');
  readonly submit = () => this.page.getByTestId("form-submit");
  readonly search = () => this.page.getByTestId("search-input");
  readonly rows = () => this.page.getByTestId("data-row");
  readonly rowByName = (name: string) =>
    this.page.getByTestId("data-row").filter({ hasText: name });
  readonly emptyState = () => this.page.getByTestId("empty-state");
  readonly formError = () => this.page.getByTestId("form-error");

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.getByTestId("page-title").waitFor();
  }

  field(name: string) {
    return this.page.getByTestId(`input-${name}`);
  }

  fieldError(name: string) {
    return this.page.getByTestId(`error-${name}`);
  }

  async openCreate() {
    await this.createButton().click();
    await this.dialog().waitFor();
  }

  async fill(values: Record<string, string>) {
    for (const [name, value] of Object.entries(values)) {
      const control = this.field(name);
      if ((await control.evaluate((el) => el.tagName)) === "SELECT") {
        await control.selectOption(value);
      } else {
        await control.fill(value);
      }
    }
  }

  async searchFor(term: string) {
    await this.search().fill(term);
    await this.search().press("Enter");
    await this.page.waitForURL((url) => url.searchParams.get("q") === term);
  }

  async openRowActions(name: string) {
    await this.rowByName(name).getByTestId("row-actions").click();
  }

  async editRow(name: string) {
    await this.openRowActions(name);
    await this.page.getByTestId("row-edit").click();
    await this.dialog().waitFor();
  }
}
