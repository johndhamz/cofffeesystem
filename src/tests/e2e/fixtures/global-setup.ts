import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { TEST_USERS, authFile } from "./users";
import { resetTestState } from "./users-admin";

/**
 * Logs each test role in once through the real UI and stores its session cookies.
 * Specs reuse the storage state, so no spec repeats the login flow.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  mkdirSync(path.resolve(__dirname, "../.auth"), { recursive: true });
  await resetTestState();
  const browser = await chromium.launch();
  try {
    for (const [role, user] of Object.entries(TEST_USERS)) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByTestId("email-input").fill(user.email);
      await page.getByTestId("password-input").fill(user.password);
      await page.getByTestId("login-submit").click();
      await page.waitForURL("**/dashboard", { timeout: 60_000 });
      await context.storageState({ path: authFile(role as keyof typeof TEST_USERS) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
