import { test as base, expect, type Page } from "@playwright/test";
import { authFile, type TestRole } from "./users";
import { LoginPage } from "../pages/login.page";
import { MasterDataPage } from "../pages/master-data.page";
import { SettingsPage } from "../pages/settings.page";
import { PurchasesPage } from "../pages/purchases.page";
import { InventoryPage } from "../pages/inventory.page";
import { RoastingPage } from "../pages/roasting.page";

type Fixtures = {
  loginPage: LoginPage;
  masterData: MasterDataPage;
  settingsPage: SettingsPage;
  purchases: PurchasesPage;
  inventory: InventoryPage;
  roasting: RoastingPage;
};

// `use` here is Playwright's fixture callback, not the React hook.
export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, provide) => provide(new LoginPage(page)),
  masterData: async ({ page }, provide) => provide(new MasterDataPage(page)),
  settingsPage: async ({ page }, provide) => provide(new SettingsPage(page)),
  purchases: async ({ page }, provide) => provide(new PurchasesPage(page)),
  inventory: async ({ page }, provide) => provide(new InventoryPage(page)),
  roasting: async ({ page }, provide) => provide(new RoastingPage(page)),
});

/** Use at the top of a describe block to run as a given role (session from global setup). */
export function asRole(role: TestRole) {
  test.use({ storageState: authFile(role) });
}

export { expect };
export type { Page };
