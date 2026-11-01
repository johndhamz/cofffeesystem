import { test, expect } from "../fixtures/test";
import { TEST_USERS } from "../fixtures/users";

test.describe("authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated users are redirected to login from protected pages", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    await page.goto("/settings/suppliers");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects wrong credentials without leaking details", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(TEST_USERS.owner.email, "wrong-password");
    await expect(loginPage.formError()).toContainText("Invalid email or password");
  });

  test("owner can log in, see the business, and log out", async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(TEST_USERS.owner.email, TEST_USERS.owner.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("business-name")).toHaveText("Kape Roastery");
    await expect(page.getByTestId("sidebar-nav")).toBeVisible();

    await page.getByTestId("user-menu-trigger").click();
    await expect(page.getByTestId("user-role")).toHaveText("Owner");
    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("password reset request page responds without revealing accounts", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#email").fill("nobody@coffee.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("reset-sent")).toBeVisible();
  });
});
