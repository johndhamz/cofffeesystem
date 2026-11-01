import type { Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  readonly email = () => this.page.getByTestId("email-input");
  readonly password = () => this.page.getByTestId("password-input");
  readonly submit = () => this.page.getByTestId("login-submit");
  readonly formError = () => this.page.getByTestId("form-error");

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.email().fill(email);
    await this.password().fill(password);
    await this.submit().click();
  }
}
