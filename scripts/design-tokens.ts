import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();

export const SKIP_FILES = new Set(["src/app/layout.tsx", "src/app/manifest.ts"]);

export type RGB = { r: number; g: number; b: number; a: number };

export type NamedColor = { hex: string; name: string };

/** Solid colours with a semantic name. Hex is lowercase, 6 digits, no hash. */
export const NAMED: NamedColor[] = [
  { hex: "14110f", name: "--color-ink" },
  { hex: "d52029", name: "--color-red" },
  { hex: "f3e4c4", name: "--color-cream" },
  { hex: "fbf4e6", name: "--color-paper" },
  { hex: "c4a36a", name: "--color-gold" },
  { hex: "ffffff", name: "--color-white" },
  { hex: "000000", name: "--color-black" },
  { hex: "1a1512", name: "--color-surface-slide" },
  { hex: "a3141c", name: "--color-link" },
  { hex: "7a1a1f", name: "--color-link-hover" },
  { hex: "3f5c3a", name: "--color-diet-green" },
  { hex: "3a2f22", name: "--color-brown" },
  { hex: "6a5640", name: "--color-brown-soft" },
  { hex: "7a4a2a", name: "--color-brown-deep" },
  { hex: "5c4a32", name: "--color-brown-roast" },
  { hex: "8a7358", name: "--color-brown-tan" },
  { hex: "fff3d9", name: "--color-cream-bright" },
  { hex: "d6cbb7", name: "--color-cream-mute" },
  { hex: "f0d9a8", name: "--color-gold-soft" },
  { hex: "3a241d", name: "--color-gesture-ink" },
  { hex: "9d7663", name: "--color-gesture-line" },
  { hex: "f5f7fa", name: "--color-admin-surface" },
  { hex: "18212f", name: "--color-admin-ink" },
  { hex: "657285", name: "--color-admin-muted" },
  { hex: "e3e7ed", name: "--color-admin-line" },
  { hex: "b52331", name: "--color-admin-accent" },
  { hex: "292724", name: "--color-admin-ws-ink" },
  { hex: "807a72", name: "--color-admin-ws-muted" },
  { hex: "6c665f", name: "--color-admin-ws-muted-quiet" },
  { hex: "e9e4dc", name: "--color-admin-ws-line" },
  { hex: "a92735", name: "--color-admin-ws-accent" },
];

export const NAMED_PROPS = new Set(NAMED.map((item) => item.name));

export const TEXT_PX: Record<string, string> = {
  "7": "--text-7",
  "8": "--text-8",
  "9": "--text-9",
  "10": "--text-10",
  "11": "--text-11",
  "12": "--text-12",
  "13": "--text-13",
  "14": "--text-caption",
  "15": "--text-15",
  "16": "--text-body",
  "17": "--text-17",
  "18": "--text-18",
  "19": "--text-19",
  "20": "--text-20",
  "21": "--text-21",
  "22": "--text-22",
  "23": "--text-23",
  "24": "--text-24",
  "25": "--text-25",
  "26": "--text-26",
  "27": "--text-27",
  "28": "--text-28",
  "32": "--text-32",
  "34": "--text-34",
};

export const TEXT_REM: Record<string, string> = {
  "0.75rem": "--text-12",
  "0.875rem": "--text-caption",
  "1rem": "--text-body",
  "1.125rem": "--text-18",
  "1.25rem": "--text-20",
  "1.625rem": "--text-26",
  "1.75rem": "--text-28",
};

export const TEXT_CLAMP: Record<string, string> = {
  "clamp(1.8rem, 4vw, 2.4rem)": "--text-doc",
  "clamp(1.0625rem, 0.98rem + 0.35vw, 1.125rem)": "--text-prose",
  "clamp(33px, 9vw, 43px)": "--text-order-title",
  "clamp(24px, 8vw, 36px)": "--text-plate",
  "clamp(24px, 6.4vw, 29px)": "--text-progress",
  "clamp(29px, 7.5vw, 36px)": "--text-hero",
};

export const Z_INDEX: Record<string, string> = {
  "-1": "--z-behind",
  "1": "--z-local",
  "2": "--z-raised",
  "3": "--z-sticky-foot",
  "5": "--z-credit",
  "10": "--z-picked",
  "20": "--z-chop",
  "22": "--z-chrome",
  "23": "--z-gesture",
  "25": "--z-sticky",
  "30": "--z-checkout",
  "40": "--z-sheet",
  "50": "--z-sidebar",
  "80": "--z-skip",
  "90": "--z-viewer",
};

/** UI transitions snap to 160ms. Sheet-length motion snaps to 280ms. */
export const DURATION_UI = new Set(["150", "160", "180", "200"]);
export const DURATION_SHEET = new Set(["220", "240", "260", "280"]);

export const SPACE_PROPS = new Set([
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "padding-block",
  "padding-block-start",
  "padding-block-end",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "gap",
  "row-gap",
  "column-gap",
  "scroll-padding",
  "scroll-margin",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "inset-inline",
  "inset-inline-start",
  "inset-inline-end",
  "inset-block",
  "inset-block-start",
  "inset-block-end",
]);

export const COLOR_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-inline",
  "border-inline-color",
  "border-block",
  "border-block-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline",
  "outline-color",
  "fill",
  "stroke",
  "caret-color",
  "box-shadow",
  "text-shadow",
  "text-decoration",
  "text-decoration-color",
  "column-rule",
  "column-rule-color",
]);

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const RGB_RE =
  /rgba?\(\s*(\d{1,3}(?:\.\d+)?)\s*(?:,|\s)\s*(\d{1,3}(?:\.\d+)?)\s*(?:,|\s)\s*(\d{1,3}(?:\.\d+)?)\s*(?:(?:,|\/)\s*([\d.]+%?))?\s*\)/g;

export type ColorHit = { start: number; end: number; rgb: RGB; raw: string };

export function relPath(file: string) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

export function sourceFiles() {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(css|tsx)$/.test(name)) out.push(full);
    }
  };
  walk(path.join(ROOT, "src"));
  return out.filter((file) => !SKIP_FILES.has(relPath(file)));
}

export function read(file: string) {
  return readFileSync(file, "utf8");
}

export function rgbKey(rgb: RGB) {
  return `${rgb.r},${rgb.g},${rgb.b}`;
}

export function hexOf(rgb: RGB) {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

export function parseHex(raw: string): RGB | null {
  let h = raw.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
}

function parseAlpha(raw: string | undefined): number {
  if (raw == null || raw === "") return 1;
  if (raw.endsWith("%")) return Number.parseFloat(raw) / 100;
  return Number.parseFloat(raw);
}

export function colorHits(text: string): ColorHit[] {
  const hits: ColorHit[] = [];
  for (const match of text.matchAll(HEX_RE)) {
    const rgb = parseHex(match[0]);
    if (!rgb || match.index == null) continue;
    hits.push({ start: match.index, end: match.index + match[0].length, rgb, raw: match[0] });
  }
  for (const match of text.matchAll(RGB_RE)) {
    if (match.index == null) continue;
    const rgb = {
      r: Math.round(Number.parseFloat(match[1])),
      g: Math.round(Number.parseFloat(match[2])),
      b: Math.round(Number.parseFloat(match[3])),
      a: parseAlpha(match[4]),
    };
    hits.push({ start: match.index, end: match.index + match[0].length, rgb, raw: match[0] });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: ColorHit[] = [];
  let cursor = -1;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    kept.push(hit);
    cursor = hit.end;
  }
  return kept;
}

export function propertyAt(text: string, index: number): string | null {
  let start = index;
  while (start > 0) {
    const ch = text[start - 1];
    if (ch === ";" || ch === "{" || ch === "}") break;
    start--;
  }
  const chunk = text.slice(start, index);
  const matches = [...chunk.matchAll(/(^|[\s;{}])(-{0,2}[A-Za-z_][\w-]*)\s*:/g)];
  if (!matches.length) return null;
  return matches[matches.length - 1][2];
}

export function inMediaHeader(text: string, index: number) {
  const before = text.slice(0, index);
  const media = Math.max(before.lastIndexOf("@media"), before.lastIndexOf("@supports"));
  if (media < 0) return false;
  return media > before.lastIndexOf("{");
}

export function matchingBrace(text: string, open: number) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function braceBlocks(text: string, header: RegExp): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const match of text.matchAll(header)) {
    if (match.index == null) continue;
    const open = text.indexOf("{", match.index);
    if (open < 0) continue;
    const close = matchingBrace(text, open);
    if (close > open) spans.push([match.index, close + 1]);
  }
  return spans;
}

export function markerSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = /\/\* design-tokens:start [\w-]+ \*\/[\s\S]*?\/\* design-tokens:end \*\//g;
  for (const match of text.matchAll(re)) {
    if (match.index == null) continue;
    spans.push([match.index, match.index + match[0].length]);
  }
  return spans;
}

export function inSpan(spans: Array<[number, number]>, index: number) {
  return spans.some(([start, end]) => index >= start && index < end);
}

/** Where a raw hex is allowed to remain. */
export function hexAllowed(rel: string, text: string, index: number) {
  if (inSpan(markerSpans(text), index)) return true;
  if (rel === "src/app/globals.css") {
    const theme = braceBlocks(text, /@theme\b[^{]*/g);
    const root = braceBlocks(text, /(?<![-\w]):root\b/g);
    if (inSpan(theme, index) || inSpan(root, index)) return true;
  }
  if (rel === "src/app/order/order.css") {
    const root = braceBlocks(text, /(?<![-\w]):root\b/g);
    if (inSpan(root, index)) return true;
  }
  if (rel === "src/app/admin/admin.css") {
    const admin = text.match(/\.admin\s*\{/);
    if (admin?.index != null) {
      const open = text.indexOf("{", admin.index);
      const close = matchingBrace(text, open);
      if (index > open && index < close && propertyAt(text, index)?.startsWith("--")) return true;
    }
  }
  return false;
}

export function scaleNumbers(globals: string) {
  const allowed = new Set<string>();
  const spans = [
    ...braceBlocks(globals, /@theme\b[^{]*/g),
    ...braceBlocks(globals, /(?<![-\w]):root\b/g),
    ...markerSpans(globals),
  ];
  for (const match of globals.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)) {
    if (match.index != null && inSpan(spans, match.index)) allowed.add(match[1]);
  }
  return allowed;
}

export function alphaPercent(a: number) {
  const pct = Math.round(a * 10000) / 100;
  return Number(pct.toFixed(2)).toString();
}

export function colorExpr(token: string, a: number) {
  if (a >= 0.999) return `var(${token})`;
  return `color-mix(in srgb, var(${token}) ${alphaPercent(a)}%, transparent)`;
}

export function spaceName(n: string) {
  return `--space-${n.replace(".", "-")}`;
}

export function radiusName(n: string) {
  if (n === "22") return "--radius-sheet";
  if (n === "999" || n === "9999") return "--radius-pill";
  return `--radius-${n.replace(".", "-")}`;
}

export function fileScope(files: string[]): "global" | "order" | "admin" {
  const rels = files.map(relPath);
  if (rels.every((file) => file.startsWith("src/app/admin/") || file.includes("/admin/"))) return "admin";
  if (rels.every((file) => file.endsWith("order.css"))) return "order";
  return "global";
}

export function maxChannelDelta(a: RGB, b: RGB) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}
