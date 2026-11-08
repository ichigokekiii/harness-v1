import { readFileSync } from "node:fs";
import { createSeed } from "../src/server/seed";

const banned = ["xavier", "kimi", "google", "xs.edu", "gmail.com"];
const text = readFileSync(new URL("../src/server/seed.ts", import.meta.url), "utf8").toLowerCase();
const hits = banned.filter((word) => text.includes(word));
if (hits.length) {
  console.error(`Banned fixture text: ${hits.join(", ")}`);
  process.exit(1);
}

const db = createSeed();
const attempts = db.evalAttempts.length;
if (attempts !== 10) {
  console.error(`Expected 10 eval rows, found ${attempts}`);
  process.exit(1);
}
if (db.users.some((user) => user.password !== "123456")) {
  console.error("Sample passwords drifted.");
  process.exit(1);
}
console.log("fixtures ok");
