import { readFileSync } from "node:fs";
import {
  DURATION_SHEET,
  DURATION_UI,
  colorHits,
  hexAllowed,
  inMediaHeader,
  relPath,
  scaleNumbers,
  sourceFiles,
} from "./design-tokens";

/**
 * Allowlist
 * - src/app/layout.tsx and src/app/manifest.ts (PWA theme and icons)
 * - Hex and rgb inside token definitions: @theme and :root in globals.css,
 *   the order.css :root block, custom properties on the first .admin rule,
 *   and design-tokens markers
 * - 0 and 0px
 * - px inside @media and @supports headers (breakpoints)
 * - Any other px whose number is declared in globals.css @theme or :root
 * - svh and dvh are not px, so they are not checked
 * - Animation times outside the UI steps stay literal: 30ms, 650ms, 760ms,
 *   .1s, .15s, .25s, .3s, .42s, .45s, .5s, .7s, 1.2s, 1.3s, 1.8s, 2.8s, 3.6s, 4.8s, 5s
 */

const globals = readFileSync("src/app/globals.css", "utf8");
const allowedPx = scaleNumbers(globals);
const snapped = new Set([...DURATION_UI, ...DURATION_SHEET]);
const failures: string[] = [];

function lineOf(text: string, index: number) {
  return text.slice(0, index).split("\n").length;
}

for (const file of sourceFiles()) {
  const text = readFileSync(file, "utf8");
  const rel = relPath(file);
  for (const hit of colorHits(text)) {
    if (hexAllowed(rel, text, hit.start)) continue;
    failures.push(`${rel}:${lineOf(text, hit.start)} raw colour ${hit.raw}`);
  }
  for (const match of text.matchAll(/(?<![\w.])(-?\d+(?:\.\d+)?)px\b/g)) {
    if (match.index == null) continue;
    const abs = match[1].replace("-", "");
    if (abs === "0") continue;
    if (hexAllowed(rel, text, match.index) || inMediaHeader(text, match.index)) continue;
    if (!allowedPx.has(abs)) failures.push(`${rel}:${lineOf(text, match.index)} off-scale ${match[0]}`);
  }
  for (const match of text.matchAll(/(?<![\w.-])(\d+)ms\b|(?<![\d.])\.2s\b/g)) {
    if (match.index == null) continue;
    if (hexAllowed(rel, text, match.index)) continue;
    const ms = match[1];
    if (ms && !snapped.has(ms)) continue;
    failures.push(`${rel}:${lineOf(text, match.index)} use var(--duration-ui) or var(--duration-sheet) instead of ${match[0]}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`${failures.length} design-token violation${failures.length === 1 ? "" : "s"}`);
  process.exit(1);
}

console.log("design tokens ok");
