import { test, expect, asRole } from "../fixtures/test";
import { ownerApi, businessId } from "../fixtures/api";
import { deleteUserByEmail, testEmail } from "../fixtures/users-admin";
import { latestAppLink } from "../fixtures/mailpit";
import { MembersPage } from "../pages/members.page";

/**
 * Phase 7 — team members: invite through the UI, accept through the emailed link (Mailpit),
 * change the role, deactivate, and confirm the deactivated person is locked out.
 */
test.describe("team members @security @regression", () => {
  asRole("owner");
  const invitee = testEmail("invitee");

  test.afterAll(async () => {
    await deleteUserByEmail(invitee);
  });

  test("owner invites a member who accepts by email and is then deactivated", async ({
    page,
    browser,
    request,
  }) => {
    const members = new MembersPage(page);
    await members.goto();
    await expect(page.getByTestId("members-table")).toBeVisible();
    await members.invite({ email: invitee, name: "Invited Tester", role: "sales_staff" });
    await expect(members.row(invitee)).toBeVisible();
    await expect(members.row(invitee)).toContainText("Invited");
    await expect(members.row(invitee).getByTestId("select-member-role")).toHaveValue("sales_staff");

    // Accept: the emailed link lands on /auth/confirm (token hash) and then the password form.
    const link = await latestAppLink(request, invitee);
    const context = await browser.newContext();
    const newUser = await context.newPage();
    await newUser.goto(link);
    await expect(newUser).toHaveURL(/\/reset-password/);
    await newUser.locator("#password").fill("InviteePass123!");
    await newUser.locator("#confirm").fill("InviteePass123!");
    await newUser.getByTestId("reset-form").getByRole("button").click();
    await expect(newUser).toHaveURL(/\/dashboard/);
    await expect(newUser.getByTestId("business-name")).toHaveText("Kape Roastery");
    await newUser.getByTestId("user-menu-trigger").click();
    await expect(newUser.getByTestId("user-role")).toHaveText("Sales Staff");
    await newUser.keyboard.press("Escape");

    // Owner sees the acceptance and can change the role.
    await page.reload();
    await expect(members.row(invitee)).toContainText("Active");
    await members.changeRole(invitee, "roaster");
    await expect(members.row(invitee).getByTestId("member-role")).toHaveText("Roaster");
    await newUser.reload();
    await newUser.getByTestId("user-menu-trigger").click();
    await expect(newUser.getByTestId("user-role")).toHaveText("Roaster");
    await newUser.keyboard.press("Escape");

    // Deactivate: the member keeps their account but loses the business.
    await members.toggleActive(invitee);
    await expect(members.row(invitee)).toContainText("Inactive");
    await newUser.goto("/dashboard");
    await expect(newUser).toHaveURL(/\/no-business/);
    await context.close();
  });

  test("owner cannot deactivate themselves or demote the last owner", async ({ page }) => {
    const members = new MembersPage(page);
    await members.goto();
    const self = members.row("owner@coffee.test");
    await expect(self.getByTestId("toggle-member-active")).toHaveCount(0);
    await self.getByTestId("select-member-role").selectOption("viewer");
    await expect(page.getByText(/at least one active owner/i)).toBeVisible();
    await expect(self.getByTestId("select-member-role")).toHaveValue("owner");
  });

  test("inviting an existing member is rejected", async ({ page }) => {
    const members = new MembersPage(page);
    await members.goto();
    await members.invite({ email: "viewer@coffee.test", role: "viewer" });
    await expect(page.getByTestId("invite-dialog").getByTestId("form-error")).toContainText(
      /already a member/i,
    );
  });
});

test.describe("team members as viewer @security", () => {
  asRole("viewer");
  test("viewer can see the team but has no management controls", async ({ page }) => {
    await page.goto("/settings/members");
    await expect(page.getByTestId("members-table")).toBeVisible();
    await expect(page.getByTestId("invite-button")).toHaveCount(0);
    await expect(page.getByTestId("member-actions")).toHaveCount(0);
  });
});

test("api: a business keeps at least one owner @security", async () => {
  const api = await ownerApi();
  const bid = await businessId(api);
  const { error } = await api
    .from("business_members")
    .update({ role: "viewer" })
    .eq("business_id", bid)
    .eq("role", "owner");
  expect(error?.message).toMatch(/at least one active owner/i);
});
