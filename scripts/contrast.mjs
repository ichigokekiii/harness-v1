function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const raw = hex.replace("#", "");
  const r = channel(parseInt(raw.slice(0, 2), 16));
  const g = channel(parseInt(raw.slice(2, 4), 16));
  const b = channel(parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = [
  ["ink on canvas", "#1a1a18", "#f7f7f5", 4.5],
  ["secondary on canvas", "#5c5a52", "#f7f7f5", 4.5],
  ["muted on canvas", "#5f5c54", "#f7f7f5", 4.5],
  ["white on navy button", "#ffffff", "#002d62", 4.5],
  ["white on danger", "#ffffff", "#9f1d1d", 4.5],
  ["navy on citation", "#000033", "#ffe512", 4.5],
  ["dark ink on dark canvas", "#eceae4", "#141413", 4.5],
  ["dark secondary", "#c2bfb6", "#141413", 4.5],
  ["dark muted", "#aaa79e", "#141413", 4.5],
  ["dark button ink", "#0c1a33", "#9ec0ef", 4.5],
  ["gold on navy dock", "#fdcc01", "#000033", 3],
];

let failed = false;
for (const [name, fg, bg, min] of pairs) {
  const score = ratio(fg, bg);
  const ok = score >= min;
  console.log(`${ok ? "ok" : "fail"} ${name}: ${score.toFixed(2)} (min ${min})`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
