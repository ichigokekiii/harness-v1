import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:3100";
const out = new URL("../docs/screens/loop/", import.meta.url).pathname;
await mkdir(out, { recursive: true });

const only = process.argv.slice(2);
const themes = only.includes("dark") ? ["dark"] : only.includes("light") ? ["light"] : ["light", "dark"];
const widths = only.includes("narrow") ? [390] : only.includes("wide") ? [1440] : [1440, 390];

const plans = [
  { user: "faculty", shots: [["chat", "/chat"], ["thread", "/chat/thread-ecosystems", "cite"], ["conflict", "/chat/thread-conflict"], ["library", "/library"], ["space", "/space/board-ecosystems"], ["forms", "/forms/form-leave"], ["settings", "/settings"]] },
  { user: "admin", shots: [["queue", "/admin/queue"], ["review", "/admin/queue"], ["people", "/admin/people"], ["tickets", "/admin/tickets"], ["audit", "/admin/audit"], ["eval", "/eval"]] },
  { user: "superadmin", shots: [["overview", "/super-admin"], ["institutions", "/super-admin/institutions"], ["health", "/super-admin/health"]] },
];

const browser = await chromium.launch();
await fetch(`${base}/api/harness/reset`, { method: "POST" });

for (const theme of themes) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, colorScheme: theme });
    await context.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
    const page = await context.newPage();
    const tag = `${theme}-${width}`;
    await page.goto(`${base}/login`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${out}login-${tag}.png` });
    for (const plan of plans) {
      if (only.length && !only.some((value) => value === plan.user || plan.shots.some(([name]) => name === value)) && !only.every((value) => ["dark", "light", "narrow", "wide"].includes(value))) continue;
      await context.clearCookies();
      await page.goto(`${base}/login`);
      await page.getByLabel("Username").fill(plan.user);
      await page.getByLabel("Password").fill("123456");
      await page.getByRole("button", { name: "Log in" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"));
      for (const [name, path, action] of plan.shots) {
        await page.goto(`${base}${path}`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(250);
        if (action === "cite") {
          await page.screenshot({ path: `${out}${plan.user}-${name}-${tag}.png` });
          await page.getByRole("button", { name: /Source 1/ }).click();
          await page.waitForTimeout(200);
          await page.screenshot({ path: `${out}${plan.user}-${name}-source-${tag}.png` });
          continue;
        }
        if (name === "review") {
          const link = page.getByRole("link", { name: "Grade 7 worksheet scan (sample)" });
          if (await link.count()) {
            await link.click();
            await page.waitForURL(/\/admin\/queue\/.+/);
            await page.getByRole("button", { name: "Approve" }).waitFor();
          }
        }
        await page.screenshot({ path: `${out}${plan.user}-${name}-${tag}.png` });
      }
    }
    await context.close();
  }
}

await browser.close();
console.log(`saved to ${out}`);
