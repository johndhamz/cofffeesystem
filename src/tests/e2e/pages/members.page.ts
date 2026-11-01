import { expect, type Locator, type Page } from "@playwright/test";

export class MembersPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/settings/members");
  }

  row(email: string): Locator {
    return this.page.getByTestId("member-row").filter({ hasText: email });
  }

  async invite(input: { email: string; name?: string; role: string }) {
    await this.page.getByTestId("invite-button").click();
    await this.page.getByTestId("input-invite-email").fill(input.email);
    if (input.name) await this.page.getByTestId("input-invite-name").fill(input.name);
    await this.page.getByTestId("select-invite-role").selectOption(input.role);
    await this.page.getByTestId("invite-submit").click();
  }

  /** Retries across the hydration window: a native select changed before React attaches fires no onChange. */
  async changeRole(email: string, role: string) {
    const select = this.row(email).getByTestId("select-member-role");
    await expect(async () => {
      await select.selectOption(role);
      await expect(this.page.getByText(/is now/)).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  }

  async toggleActive(email: string) {
    await this.row(email).getByTestId("toggle-member-active").click();
    await this.page.getByTestId("member-active-dialog-confirm").click();
  }
}
