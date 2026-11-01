import { test, expect, asRole } from "../fixtures/test";
import { unique } from "../fixtures/users";

test.describe("master data as owner", () => {
  asRole("owner");

  test("owner creates a supplier and sees it in the list and detail view", async ({
    page,
    masterData,
  }) => {
    const name = unique("Benguet Growers");
    await masterData.goto("/settings/suppliers");
    await masterData.openCreate();
    await masterData.fill({
      name,
      contact_person: "Ana Cruz",
      phone: "0917 000 0000",
      email: "ana@example.com",
    });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
    await masterData.searchFor(name);
    await expect(masterData.rowByName(name)).toBeVisible();
    await expect(masterData.rowByName(name).getByTestId("status-badge")).toHaveText("Active");

    await masterData.rowByName(name).getByTestId("row-name").click();
    await expect(page.getByTestId("page-title")).toHaveText(name);
    await expect(page.getByTestId("detail-contact_person")).toHaveText("Ana Cruz");
  });

  test("owner edits a supplier", async ({ masterData }) => {
    const name = unique("Edit Supplier");
    await masterData.goto("/settings/suppliers");
    await masterData.openCreate();
    await masterData.fill({ name });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
    await masterData.searchFor(name);

    await masterData.editRow(name);
    await masterData.fill({ contact_person: "Updated Contact", name: `${name} v2` });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
    await expect(masterData.rowByName(`${name} v2`)).toContainText("Updated Contact");
  });

  test("duplicate supplier names are rejected with a field error", async ({ masterData }) => {
    const name = unique("Dup Supplier");
    await masterData.goto("/settings/suppliers");
    await masterData.openCreate();
    await masterData.fill({ name });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();

    await masterData.openCreate();
    await masterData.fill({ name: name.toUpperCase() });
    await masterData.submit().click();
    await expect(masterData.fieldError("name")).toContainText("already exists");
    await expect(masterData.dialog()).toBeVisible();
  });

  test("owner creates a green coffee with optional measurements blank", async ({
    page,
    masterData,
  }) => {
    const name = unique("Kalinga Arabica Natural");
    await masterData.goto("/green-coffee");
    await masterData.openCreate();
    await masterData.fill({
      name,
      country: "Philippines",
      region: "Kalinga",
      variety: "Arabica",
      processing_method: "Natural",
    });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();
    await masterData.searchFor(name);
    await expect(masterData.rowByName(name)).toBeVisible();
    await masterData.rowByName(name).getByTestId("row-name").click();
    await expect(page.getByTestId("detail-altitude_masl")).toHaveText("—");
    await expect(page.getByTestId("detail-processing_method")).toHaveText("Natural");
  });

  test("invalid green coffee altitude is rejected client-side", async ({ masterData }) => {
    await masterData.goto("/green-coffee");
    await masterData.openCreate();
    await masterData.fill({ name: unique("Bad Altitude"), altitude_masl: "-10" });
    await masterData.submit().click();
    await expect(masterData.fieldError("altitude_masl")).toContainText("cannot be negative");
  });

  test("owner configures the roaster and sets it as default", async ({
    page,
    masterData,
    settingsPage,
  }) => {
    await masterData.goto("/settings/roasters");
    await masterData.searchFor("Yoshan");
    await expect(masterData.rowByName("Yoshan DY-2kg")).toContainText("2 kg");

    await masterData.editRow("Yoshan DY-2kg");
    await masterData.fill({ notes: `Checked ${new Date().toISOString()}` });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();

    const roasterName = unique("Probat Test");
    await masterData.openCreate();
    await masterData.fill({ name: roasterName, capacity_g: "0" });
    await masterData.submit().click();
    await expect(masterData.fieldError("capacity_g")).toContainText("at least 1");
    await masterData.fill({ capacity_g: "5000" });
    await masterData.submit().click();
    await expect(masterData.dialog()).toBeHidden();

    await settingsPage.goto();
    await settingsPage.defaultRoaster().selectOption({ label: "Yoshan DY-2kg" });
    await settingsPage.submit().click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await page.reload();
    const yoshanValue = await settingsPage
      .defaultRoaster()
      .locator("option", { hasText: "Yoshan DY-2kg" })
      .getAttribute("value");
    // toHaveValue retries until React has hydrated the form with the saved setting.
    await expect(settingsPage.defaultRoaster()).toHaveValue(yoshanValue!);
  });

  test("list supports status filter, sorting and pagination controls", async ({
    page,
    masterData,
  }) => {
    await masterData.goto("/green-coffee");
    await expect(masterData.rows().first()).toBeVisible();
    await page.getByTestId("sort-name").click();
    await expect(page).toHaveURL(/sort=name/);
    await page.getByTestId("filter-status").selectOption("inactive");
    await expect(page).toHaveURL(/status=inactive/);
    await page.getByTestId("filter-status").selectOption("all");
    await expect(page.getByTestId("table-summary")).toContainText("Showing");
  });
});

test.describe("master data as viewer", () => {
  asRole("viewer");

  test("viewer cannot create or edit suppliers and cannot change settings", async ({
    page,
    masterData,
    settingsPage,
  }) => {
    await masterData.goto("/settings/suppliers");
    await expect(masterData.createButton()).toHaveCount(0);
    await expect(page.getByTestId("row-actions")).toHaveCount(0);

    await settingsPage.goto();
    await expect(settingsPage.submit()).toHaveCount(0);
    await expect(settingsPage.readOnlyNotice()).toBeVisible();
    await expect(settingsPage.businessName()).toBeDisabled();

    await page.goto("/purchases/new");
    await expect(page.getByTestId("access-denied")).toBeVisible();
  });
});
