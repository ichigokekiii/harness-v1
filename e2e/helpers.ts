import { expect, type Page } from "@playwright/test";

export async function reset(page: Page) {
  const response = await page.request.post("/api/harness/reset");
  expect(response.ok()).toBeTruthy();
}

export async function login(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
