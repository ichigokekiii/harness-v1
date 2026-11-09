import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login, reset } from "./helpers";

test("no request leaves this machine", async ({ page }) => {
  const leaked: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") leaked.push(url.href);
  });
  await reset(page);
  await login(page, "faculty");
  await page.getByLabel("Message").fill("What should Grade 7 study about ecosystems?");
  await page.getByRole("button", { name: "Send" }).click();
  expect(leaked).toEqual([]);
});

test("login, chat, queue, and overview have no serious axe violations", async ({ page }) => {
  await reset(page);
  const routes: { user: string; path: string }[] = [
    { user: "faculty", path: "/chat" },
    { user: "admin", path: "/admin/queue" },
    { user: "superadmin", path: "/super-admin" },
  ];
  for (const route of routes) {
    await login(page, route.user);
    await page.goto(route.path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(blocking, route.path).toEqual([]);
  }
});

test("the theme toggle adds the dark class", async ({ page }) => {
  await reset(page);
  await login(page, "faculty");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
