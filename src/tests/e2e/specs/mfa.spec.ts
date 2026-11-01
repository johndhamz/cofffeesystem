import { test, expect } from "../fixtures/test";
import { ownerApi, businessId } from "../fixtures/api";
import { createMemberUser, deleteUserByEmail, setRequireMfa } from "../fixtures/users-admin";
import { SecurityPage } from "../pages/security.page";
import { LoginPage } from "../pages/login.page";

/**
 * Phase 7 — two-factor authentication. Uses a throwaway member (never the seeded roles) so the
 * stored sessions used by the other specs are unaffected.
 */
test.describe("two-factor authentication @security @regression", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let user: { email: string; password: string };
  let bid: string;

  test.beforeAll(async () => {
    bid = await businessId(await ownerApi());
    user = await createMemberUser(bid, "roaster");
  });
  test.afterAll(async () => {
    await setRequireMfa(bid, false);
    await deleteUserByEmail(user.email);
  });

  test("enrol an authenticator, then sign-in requires the code", async ({ page }) => {
    const login = new LoginPage(page);
    const security = new SecurityPage(page);
    await login.goto();
    await login.login(user.email, user.password);
    await expect(page).toHaveURL(/\/dashboard/);

    await security.goto();
    await expect(page.getByTestId("mfa-card")).toHaveAttribute("data-enabled", "false");
    const totp = await security.enrol();
    await expect(page.getByTestId("mfa-card")).toHaveAttribute("data-enabled", "true");
    await expect(page.getByTestId("mfa-factors")).toContainText("session level aal2");

    // New session: password alone is not enough any more.
    await page.getByTestId("user-menu-trigger").click();
    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login/);
    await login.login(user.email, user.password);
    await expect(page).toHaveURL(/\/mfa/);
    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/mfa\?next=%2Finventory/);

    await security.answerChallenge("000000");
    await expect(page.getByTestId("form-error")).toContainText(/invalid code/i);
    await security.answerChallenge(totp.generate());
    await expect(page).toHaveURL(/\/inventory/);

    // Verified sessions are not asked again; removing the factor restores password-only sign-in.
    await page.goto("/mfa");
    await expect(page).toHaveURL(/\/dashboard/);
    await security.goto();
    await security.remove();
    await expect(page.getByTestId("mfa-card")).toHaveAttribute("data-enabled", "false");
  });

  test("owner can require two-factor authentication for every member", async ({ page }) => {
    const login = new LoginPage(page);
    await setRequireMfa(bid, true);
    await login.goto();
    await login.login(user.email, user.password);
    await expect(page).toHaveURL(/\/settings\/security/);
    await expect(page.getByTestId("mfa-required-banner")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/settings\/security/);
    await setRequireMfa(bid, false);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("MFA policy in business settings @security", () => {
  test.use({ storageState: "src/tests/e2e/.auth/owner.json" });
  test.afterAll(async () => {
    await setRequireMfa(await businessId(await ownerApi()), false);
  });

  test("the owner can switch the policy on and is asked to enrol as well", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("select-require_mfa")).toHaveValue("false");
    await page.getByTestId("select-require_mfa").selectOption("true");
    await page.getByTestId("settings-submit").click();
    await expect(page.getByText(/saved/i).first()).toBeVisible();
    // The policy applies to the owner too: without an authenticator every page leads to Security.
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/security/);
    await expect(page.getByTestId("mfa-required-banner")).toBeVisible();
    const api = await ownerApi();
    const { data } = await api
      .from("business_settings")
      .select("require_mfa")
      .eq("business_id", await businessId(api))
      .single();
    expect(data?.require_mfa).toBe(true);
    await setRequireMfa(await businessId(api), false);
    await page.goto("/settings");
    await expect(page.getByTestId("select-require_mfa")).toHaveValue("false");
  });
});
