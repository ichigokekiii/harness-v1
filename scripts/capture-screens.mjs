import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const out = new URL("../docs/screens/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const name of ["impeccable", "editorial", "dock", "paper"]) {
  await page.goto(`file://${new URL(`../bakeoff/${name}/index.html`, import.meta.url).pathname}`);
  await page.screenshot({ path: new URL(`${name}.png`, out).pathname, fullPage: true });
}

await page.goto("http://127.0.0.1:3100/login");
await page.screenshot({ path: new URL("login.png", out).pathname });
await page.getByLabel("Username").fill("faculty");
await page.getByLabel("Password").fill("123456");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL("**/chat");
await page.screenshot({ path: new URL("chat.png", out).pathname });
await page.getByRole("button", { name: "Grade 7 ecosystems" }).click();
await page.waitForURL("**/thread-ecosystems");
await page.getByRole("button", { name: /Source 1/ }).click();
await page.screenshot({ path: new URL("chat-citation.png", out).pathname });
await page.goto("http://127.0.0.1:3100/space/board-ecosystems");
await page.getByText("Draft-AI, teacher edit required", { exact: true }).waitFor();
await page.screenshot({ path: new URL("space.png", out).pathname });
await page.context().clearCookies();
await page.goto("http://127.0.0.1:3100/login");
await page.getByLabel("Username").fill("admin");
await page.getByLabel("Password").fill("123456");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL("**/admin/queue");
await page.screenshot({ path: new URL("queue.png", out).pathname });

const narrow = await browser.newPage({ viewport: { width: 390, height: 800 } });
await narrow.goto("http://127.0.0.1:3100/login");
await narrow.getByLabel("Username").fill("faculty");
await narrow.getByLabel("Password").fill("123456");
await narrow.getByRole("button", { name: "Log in" }).click();
await narrow.waitForURL("**/chat");
await narrow.screenshot({ path: new URL("chat-390.png", out).pathname });
await browser.close();
console.log("screens saved");
