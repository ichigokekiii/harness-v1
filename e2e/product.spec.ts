import { expect, test } from "@playwright/test";
import { login, reset } from "./helpers";

test.beforeEach(async ({ page }) => {
  await reset(page);
});

test("a citation opens the highlighted page", async ({ page }) => {
  await login(page, "faculty");
  await page.getByRole("button", { name: "Grade 7 ecosystems" }).click();
  await expect(page).toHaveURL(/thread-ecosystems/);
  await page.getByRole("button", { name: /Source 1/ }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByText("Grade 7 Ecosystems (sample)").first()).toBeVisible();
});

test("a bad upload is rejected and a share stays pending", async ({ page }) => {
  await login(page, "faculty");
  await page.getByRole("link", { name: "Library" }).click();
  await page.getByRole("tab", { name: "My folder" }).click();
  await page.getByLabel("Upload").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByText("Use a PDF, JPEG, or PNG.")).toBeVisible();
  await page.getByRole("button", { name: "Share to institution library" }).click();
  await expect(page.getByText("share pending")).toBeVisible();
});

test("approve updates the queue", async ({ page }) => {
  await login(page, "admin");
  await page.getByRole("link", { name: "Grade 7 worksheet scan (sample)" }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Status is now approved/)).toBeVisible();
});

test("space undo restores a deleted frame", async ({ page }) => {
  await login(page, "faculty");
  await page.goto("/space/board-ecosystems");
  await expect(page.getByText("Draft-AI, teacher edit required", { exact: true })).toBeVisible();
  const frame = page.getByRole("button", { name: "Grade 7 Ecosystems", exact: true });
  await frame.focus();
  await page.keyboard.press("Delete");
  await expect(frame).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(frame).toHaveCount(1);
});

test("eval csv has 10 rows", async ({ page }) => {
  await login(page, "faculty");
  const text = await page.evaluate(async () => {
    const response = await fetch("/api/harness/eval/export");
    return response.text();
  });
  const rows = text.trim().split("\n");
  expect(rows).toHaveLength(11);
  expect(text).toContain("skip");
  expect(text).toContain("timeout");
});

for (const width of [390, 1280]) {
  test(`chat fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await login(page, "faculty");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBeFalsy();
  });
}
