import type { Page } from "@playwright/test";

export class SettingsPage {
  constructor(private readonly page: Page) {}

  readonly form = () => this.page.getByTestId("business-settings-form");
  readonly businessName = () => this.page.getByTestId("input-business_name");
  readonly defaultRoaster = () => this.page.getByTestId("select-default_roaster_id");
  readonly submit = () => this.page.getByTestId("settings-submit");
  readonly readOnlyNotice = () => this.page.getByTestId("settings-readonly");

  async goto() {
    await this.page.goto("/settings");
    await this.form().waitFor();
  }
}
