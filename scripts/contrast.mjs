import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map(([, name, value]) => [name, value]));
}

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const raw = hex.replace("#", "");
  return 0.2126 * channel(parseInt(raw.slice(0, 2), 16)) + 0.7152 * channel(parseInt(raw.slice(2, 4), 16)) + 0.0722 * channel(parseInt(raw.slice(4, 6), 16));
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (hi + 0.05) / (lo + 0.05);
}

const text = ["text-primary", "text-secondary", "text-muted"];
const surfaces = ["bg-root", "bg-sidebar", "bg-panel", "bg-soft"];
const pairs = [
  ...text.flatMap((fg) => surfaces.map((bg) => [fg, bg, 4.5])),
  ["primary-ink", "primary", 4.5],
  ["danger", "bg-root", 4.5],
  ["warning", "bg-root", 4.5],
  ["cite-ink", "cite", 4.5],
];

let failed = false;
let lowest = Infinity;
for (const [theme, tokens] of [["light", block(":root")], ["dark", { ...block(":root"), ...block(".dark") }]]) {
  for (const [fg, bg, min] of pairs) {
    const score = ratio(tokens[fg], tokens[bg]);
    lowest = Math.min(lowest, score);
    const ok = score >= min;
    if (!ok) failed = true;
    console.log(`${ok ? "ok  " : "FAIL"} ${theme} ${fg} on ${bg}: ${score.toFixed(2)} (min ${min})`);
  }
}
console.log(`lowest pair ${lowest.toFixed(2)}`);
if (failed) process.exit(1);
