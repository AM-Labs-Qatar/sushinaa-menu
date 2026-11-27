import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  COLOR_PROPS,
  DURATION_SHEET,
  DURATION_UI,
  NAMED,
  NAMED_PROPS,
  ROOT,
  SPACE_PROPS,
  TEXT_CLAMP,
  TEXT_PX,
  TEXT_REM,
  Z_INDEX,
  colorExpr,
  colorHits,
  fileScope,
  hexAllowed,
  hexOf,
  inMediaHeader,
  matchingBrace,
  maxChannelDelta,
  propertyAt,
  radiusName,
  relPath,
  rgbKey,
  sourceFiles,
  spaceName,
  type RGB,
} from "./design-tokens";

type Scope = "global" | "order" | "admin";

type Opaque = {
  key: string;
  hex: string;
  rgb: RGB;
  count: number;
  files: Set<string>;
};

const namedByKey = new Map(NAMED.map((item) => [rgbKey(parseNamed(item.hex)), item.name]));

function parseNamed(hex: string): RGB {
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: 1,
  };
}

function autoName(scope: Scope, hex: string) {
  if (scope === "admin") return `--admin-c-${hex}`;
  if (scope === "order") return `--order-c-${hex}`;
  return `--color-c-${hex}`;
}

function markerBlock(id: string, lines: string[], pad: string) {
  if (!lines.length) return "";
  const decls = lines.map((line) => `${pad}${line.trim()}`).join("\n");
  return `${pad}/* design-tokens:start ${id} */\n${decls}\n${pad}/* design-tokens:end */`;
}

function replaceMarker(text: string, id: string, block: string) {
  const re = new RegExp(`[ \\t]*\\/\\* design-tokens:start ${id} \\*\\/[\\s\\S]*?\\/\\* design-tokens:end \\*\\/\\n?`);
  if (!re.test(text)) return null;
  return text.replace(re, block ? `${block}\n` : "");
}

function insertGlobalMarker(text: string, id: string, lines: string[]) {
  const block = markerBlock(id, lines, "  ");
  const replaced = replaceMarker(text, id, block);
  if (replaced != null) return replaced;
  if (!block) return text;
  const header = text.match(/(?<![-\w]):root\b/);
  if (header?.index == null) throw new Error("globals.css is missing :root");
  const open = text.indexOf("{", header.index);
  const close = matchingBrace(text, open);
  return `${text.slice(0, close)}\n${block}\n${text.slice(close)}`;
}

function insertOrderMarker(text: string, lines: string[]) {
  const inner = lines.length ? `:root {\n${lines.map((line) => `  ${line.trim()}`).join("\n")}\n}` : "";
  const block = inner
    ? `/* design-tokens:start order */\n${inner}\n/* design-tokens:end */`
    : "";
  const replaced = replaceMarker(text, "order", block);
  if (replaced != null) return replaced;
  if (!block) return text;
  return `${block}\n\n${text}`;
}

function insertAdminMarker(text: string, lines: string[]) {
  const block = markerBlock("admin", lines, "  ");
  const replaced = replaceMarker(text, "admin", block);
  if (replaced != null) return replaced;
  if (!block) return text;
  const anchor = "--accent: var(--color-admin-accent);";
  const at = text.indexOf(anchor);
  if (at < 0) throw new Error("admin.css is missing --accent alias");
  const lineEnd = text.indexOf("\n", at);
  return `${text.slice(0, lineEnd)}\n${block}${text.slice(lineEnd)}`;
}

function tokenFor(key: string, a: number, assigned: Map<string, string>) {
  if (key === "0,0,0") return a < 0.999 ? "--color-shadow" : "--color-black";
  return namedByKey.get(key) ?? assigned.get(key) ?? null;
}

function collectOpaques(files: Map<string, string>) {
  const map = new Map<string, Opaque>();
  for (const [file, text] of files) {
    for (const hit of colorHits(text)) {
      if (hexAllowed(relPath(file), text, hit.start)) continue;
      const prop = propertyAt(text, hit.start);
      if (prop && NAMED_PROPS.has(prop)) continue;
      const key = rgbKey(hit.rgb);
      if (namedByKey.has(key) || key === "0,0,0") continue;
      const row = map.get(key) ?? {
        key,
        hex: hexOf(hit.rgb),
        rgb: { ...hit.rgb, a: 1 },
        count: 0,
        files: new Set<string>(),
      };
      row.count += 1;
      row.files.add(file);
      map.set(key, row);
    }
  }
  return map;
}

function mergeNear(opaques: Map<string, Opaque>) {
  const ranked = [...opaques.values()].sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
  const kept: Opaque[] = [];
  const alias = new Map<string, string>();
  const merges: string[] = [];
  for (const color of ranked) {
    const host = kept.find((item) => maxChannelDelta(item.rgb, color.rgb) <= 1);
    if (!host) {
      kept.push(color);
      continue;
    }
    alias.set(color.key, host.key);
    host.count += color.count;
    for (const file of color.files) host.files.add(file);
    merges.push(`#${color.hex} -> #${host.hex} (channel delta <= 1, ${color.count} use${color.count === 1 ? "" : "s"})`);
  }
  return { kept, alias, merges };
}

function existingAuto(text: string) {
  const found: { scope: Scope; name: string; hex: string; key: string }[] = [];
  const re = /--((?:admin-c|order-c|color-c)-([0-9a-f]{6}))\s*:\s*#([0-9a-f]{6})/g;
  for (const match of text.matchAll(re)) {
    const scope: Scope = match[1].startsWith("admin") ? "admin" : match[1].startsWith("order") ? "order" : "global";
    const hex = match[3];
    found.push({ scope, name: `--${match[1]}`, hex, key: rgbKey(parseNamed(hex)) });
  }
  return found;
}

function migrateColors() {
  const files = new Map(sourceFiles().map((file) => [file, readFileSync(file, "utf8")]));
  const opaques = collectOpaques(files);
  const { kept, alias, merges } = mergeNear(opaques);
  const assigned = new Map<string, string>();
  const byScope: Record<Scope, string[]> = { global: [], order: [], admin: [] };
  const seen = new Set<string>();
  const remember = (scope: Scope, name: string, hex: string, key: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    assigned.set(key, name);
    byScope[scope].push(`${name}: #${hex};`);
  };
  for (const text of files.values()) {
    for (const item of existingAuto(text)) remember(item.scope, item.name, item.hex, item.key);
  }
  for (const color of kept) {
    if (assigned.has(color.key)) continue;
    const scope = fileScope([...color.files]);
    remember(scope, autoName(scope, color.hex), color.hex, color.key);
  }
  for (const [from, to] of alias) assigned.set(from, assigned.get(to)!);

  const globalsPath = path.join(ROOT, "src/app/globals.css");
  const orderPath = path.join(ROOT, "src/app/order/order.css");
  const adminPath = path.join(ROOT, "src/app/admin/admin.css");
  for (const scope of ["global", "order", "admin"] as const) byScope[scope].sort();
  files.set(globalsPath, insertGlobalMarker(files.get(globalsPath)!, "global", byScope.global));
  files.set(orderPath, insertOrderMarker(files.get(orderPath)!, byScope.order));
  files.set(adminPath, insertAdminMarker(files.get(adminPath)!, byScope.admin));

  let replaced = 0;
  for (const [file, text] of files) {
    const next = applyColorExprs(text, file, assigned);
    replaced += next.count;
    files.set(file, next.text);
  }
  for (const [file, text] of files) {
    if (text !== readFileSync(file, "utf8")) writeFileSync(file, text);
  }
  console.log(`color replacements: ${replaced}`);
  console.log(`auto tokens: global ${byScope.global.length}, order ${byScope.order.length}, admin ${byScope.admin.length}`);
  console.log(merges.length ? `near-dupe merges:\n${merges.join("\n")}` : "near-dupe merges: none");
}

function applyColorExprs(text: string, file: string, assigned: Map<string, string>) {
  const rel = relPath(file);
  const hits = colorHits(text).filter((hit) => {
    if (hexAllowed(rel, text, hit.start)) return false;
    const prop = propertyAt(text, hit.start);
    if (prop && NAMED_PROPS.has(prop)) return false;
    return true;
  });
  let next = text;
  let count = 0;
  for (const hit of hits.sort((a, b) => b.start - a.start)) {
    const token = tokenFor(rgbKey(hit.rgb), hit.rgb.a, assigned);
    if (!token) continue;
    const prop = propertyAt(next, hit.start);
    if (prop === token) continue;
    const expr = colorExpr(token, hit.rgb.a);
    next = next.slice(0, hit.start) + expr + next.slice(hit.end);
    count++;
  }
  if (rel.endsWith(".css")) {
    const keywords = applyKeywords(next);
    next = keywords.text;
    count += keywords.count;
  }
  return { text: next, count };
}

function applyKeywords(text: string) {
  const re = /(?<![\w-])(white|black)(?![\w-])/g;
  const matches = [...text.matchAll(re)];
  let next = text;
  let count = 0;
  for (const match of matches.sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
    if (match.index == null) continue;
    const prop = propertyAt(next, match.index);
    if (!prop || !COLOR_PROPS.has(prop) || prop.startsWith("--") || NAMED_PROPS.has(prop)) continue;
    const token = match[1] === "white" ? "--color-white" : "--color-black";
    next = next.slice(0, match.index) + `var(${token})` + next.slice(match.index + match[1].length);
    count++;
  }
  return { text: next, count };
}

function migrateScales() {
  const files = new Map(sourceFiles().map((file) => [file, readFileSync(file, "utf8")]));
  const globalsPath = path.join(ROOT, "src/app/globals.css");
  const numbers = new Set<string>();
  for (const [file, text] of files) {
    const rel = relPath(file);
    for (const match of text.matchAll(/(?<![\w.])(-?\d+(?:\.\d+)?)px\b/g)) {
      if (match.index == null) continue;
      const abs = match[1].replace("-", "");
      if (abs === "0") continue;
      if (hexAllowed(rel, text, match.index) || inMediaHeader(text, match.index)) continue;
      if (propertyAt(text, match.index)?.startsWith("--")) continue;
      numbers.add(abs);
    }
    for (const match of text.matchAll(/var\(--space-(\d+(?:-\d+)?)\)/g)) {
      numbers.add(match[1].includes("-") ? match[1].replace("-", ".") : match[1]);
    }
  }
  const globals = files.get(globalsPath)!;
  for (const match of globals.matchAll(/--space-[\d-]+\s*:\s*(\d+(?:\.\d+)?)px/g)) numbers.add(match[1]);
  const lines = [...numbers].sort((a, b) => Number(a) - Number(b)).map((n) => `${spaceName(n)}: ${n}px;`);
  files.set(globalsPath, insertGlobalMarker(globals, "space", lines));

  let replaced = 0;
  const snaps: string[] = [];
  for (const [file] of files) {
    const next = applyScales(files.get(file)!, relPath(file), snaps);
    replaced += next.count;
    files.set(file, next.text);
  }
  for (const [file, text] of files) {
    if (text !== readFileSync(file, "utf8")) writeFileSync(file, text);
  }
  console.log(`scale replacements: ${replaced}`);
  const uniqueSnaps = [...new Set(snaps)];
  console.log(uniqueSnaps.length ? `duration snaps:\n${uniqueSnaps.join("\n")}` : "duration snaps: none");
}

function applyScales(text: string, rel: string, snaps: string[]) {
  let next = text;
  let count = 0;
  const px = [...next.matchAll(/(?<![\w.-])(-?\d+(?:\.\d+)?)px\b/g)];
  for (const match of px.sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
    if (match.index == null) continue;
    const raw = match[1];
    const abs = raw.startsWith("-") ? raw.slice(1) : raw;
    if (abs === "0") continue;
    if (hexAllowed(rel, next, match.index) || inMediaHeader(next, match.index)) continue;
    const prop = propertyAt(next, match.index);
    if (!prop || prop.startsWith("--")) continue;
    const token = lengthToken(prop, abs);
    if (!token) continue;
    const expr = raw.startsWith("-") ? `calc(${token} * -1)` : token;
    next = next.slice(0, match.index) + expr + next.slice(match.index + match[0].length);
    count++;
  }

  const clamps = Object.keys(TEXT_CLAMP).sort((a, b) => b.length - a.length);
  for (const clamp of clamps) {
    let at = next.indexOf(clamp);
    while (at >= 0) {
      if (!hexAllowed(rel, next, at) && propertyAt(next, at) === "font-size") {
        const token = `var(${TEXT_CLAMP[clamp]})`;
        next = next.slice(0, at) + token + next.slice(at + clamp.length);
        count++;
        at = next.indexOf(clamp, at + token.length);
      } else at = next.indexOf(clamp, at + clamp.length);
    }
  }

  const rems = [...next.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)rem\b/g)];
  for (const match of rems.sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
    if (match.index == null) continue;
    if (hexAllowed(rel, next, match.index)) continue;
    if (propertyAt(next, match.index) !== "font-size") continue;
    const token = TEXT_REM[`${match[1]}rem`];
    if (!token) continue;
    next = next.slice(0, match.index) + `var(${token})` + next.slice(match.index + match[0].length);
    count++;
  }

  const z = [...next.matchAll(/z-index:\s*(-?\d+)\b/g)];
  for (const match of z.sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
    if (match.index == null) continue;
    if (hexAllowed(rel, next, match.index)) continue;
    const token = Z_INDEX[match[1]];
    if (!token) continue;
    const full = match[0];
    const expr = `z-index: var(${token})`;
    next = next.slice(0, match.index) + expr + next.slice(match.index + full.length);
    count++;
  }

  const ms = [...next.matchAll(/(?<![\w.-])(\d+)ms\b/g)];
  for (const match of ms.sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
    if (match.index == null) continue;
    if (hexAllowed(rel, next, match.index)) continue;
    const prop = propertyAt(next, match.index);
    if (prop?.startsWith("--")) continue;
    const token = DURATION_UI.has(match[1]) ? "--duration-ui" : DURATION_SHEET.has(match[1]) ? "--duration-sheet" : "";
    if (!token) continue;
    if (match[1] !== "160" && match[1] !== "280") snaps.push(`${match[1]}ms -> var(${token})`);
    next = next.slice(0, match.index) + `var(${token})` + next.slice(match.index + match[0].length);
    count++;
  }

  const seconds = [...next.matchAll(/(?<![\d.])\.2s\b/g)];
  for (const match of seconds.sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
    if (match.index == null) continue;
    if (hexAllowed(rel, next, match.index)) continue;
    if (propertyAt(next, match.index)?.startsWith("--")) continue;
    snaps.push(".2s -> var(--duration-ui)");
    next = next.slice(0, match.index) + "var(--duration-ui)" + next.slice(match.index + match[0].length);
    count++;
  }
  return { text: next, count };
}

function lengthToken(prop: string, abs: string) {
  if (prop === "font-size" || prop === "font") {
    const text = TEXT_PX[abs];
    return text ? `var(${text})` : null;
  }
  if (prop === "border-radius" || prop.endsWith("-radius")) return `var(${radiusName(abs)})`;
  if (SPACE_PROPS.has(prop)) return `var(${spaceName(abs)})`;
  return null;
}

const mode = process.argv[2] ?? "all";
if (mode === "colors" || mode === "all") migrateColors();
if (mode === "scales" || mode === "all") migrateScales();
if (!["colors", "scales", "all"].includes(mode)) {
  console.error("usage: tsx scripts/design-tokens-migrate.ts [colors|scales|all]");
  process.exit(1);
}
