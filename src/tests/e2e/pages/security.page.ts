import type { Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

export class SecurityPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/settings/security");
  }

  /** Enrols a TOTP factor through the UI and returns a generator for valid codes. */
  async enrol(): Promise<OTPAuth.TOTP> {
    await this.page.getByTestId("mfa-enable").click();
    const secret = (await this.page.getByTestId("mfa-secret").textContent())?.trim() ?? "";
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      digits: 6,
      period: 30,
    });
    await this.page.getByTestId("mfa-code").fill(totp.generate());
    await this.page.getByTestId("mfa-verify").click();
    return totp;
  }

  async remove() {
    await this.page.getByTestId("mfa-remove").click();
    await this.page.getByTestId("mfa-remove-dialog-confirm").click();
  }

  async answerChallenge(code: string) {
    await this.page.getByTestId("mfa-login-code").fill(code);
    await this.page.getByTestId("mfa-login-submit").click();
  }
}
