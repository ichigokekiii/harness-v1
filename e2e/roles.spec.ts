import { expect, test } from "@playwright/test";
import { login, reset } from "./helpers";

test.beforeEach(async ({ page }) => {
  await reset(page);
});

test("faculty, admin, and super admin land on their own homes", async ({ page }) => {
  await login(page, "faculty");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();

  await login(page, "admin");
  await expect(page).toHaveURL(/\/admin\/queue$/);
  await expect(page.getByRole("heading", { name: "Queue" })).toBeVisible();

  await login(page, "superadmin");
  await expect(page).toHaveURL(/\/super-admin$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("a faculty session cannot open the admin queue", async ({ page }) => {
  await login(page, "faculty");
  await page.goto("/admin/queue");
  await expect(page).toHaveURL(/\/chat$/);
});

test("a wrong password is shown", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("faculty");
  await page.getByLabel("Password").fill("nope");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("did not match")).toBeVisible();
});
