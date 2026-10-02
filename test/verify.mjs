import { readFileSync } from "node:fs";
import { initLayouts, getForwardMapping, getBackwardMapping } from "../src/lib/util.js";
import { Text } from "../src/lib/config/text.js";
import { Config7 } from "../src/lib/config/config7.js";

// Node's fetch() can't follow file:// URLs, so layout JSON is served from a
// local static server for this smoke test; a real browser build resolves
// these against the page's own URL instead.
await initLayouts("http://localhost:8934/public/");

const files = ["default", "system", "empty"];
let allOk = true;

for (const name of files) {
  const text = readFileSync(new URL(`../src/samples/${name}.tctl.txt`, import.meta.url), "utf8");
  const cfg = Text.read(text, "qwerty");
  const bytes = Config7.write(cfg, "qwerty");

  const refPath = `/tmp/${name}.cfg`;
  const ref = new Uint8Array(readFileSync(refPath));

  const match = bytes.length === ref.length && bytes.every((b, i) => b === ref[i]);
  console.log(`${name}: ${match ? "MATCH" : "MISMATCH"} (js=${bytes.length}B, py=${ref.length}B)`);
  if (!match) {
    allOk = false;
    for (let i = 0; i < Math.max(bytes.length, ref.length); i++) {
      if (bytes[i] !== ref[i]) {
        console.log(`  first diff at byte ${i}: js=${bytes[i]} py=${ref[i]}`);
        break;
      }
    }
  }
}

// Spot-check a few layout mappings against known-good HID codes.
const qwertyFwd = getForwardMapping("qwerty");
console.log("qwerty 0x04 ->", qwertyFwd.get(0x04), "(expect a)");
const qwertyBack = getBackwardMapping("qwerty");
console.log("qwerty 'a' ->", qwertyBack.get("a")?.toString(16), "(expect 4)");

const colemakFwd = getForwardMapping("colemak");
console.log("colemak 0x04 ->", colemakFwd.get(0x04));

console.log(allOk ? "\nALL BINARY CONFIGS MATCH" : "\nSOME MISMATCHES FOUND");
process.exit(allOk ? 0 : 1);
