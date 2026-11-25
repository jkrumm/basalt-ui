/**
 * The docs palette check: every Starlight and Expressive Code color variable in the built docs CSS resolves
 * to a `--basalt-*` token. Starlight and Expressive Code write their defaults (hex, hsl) inside cascade
 * layers; `basalt-ui/starlight.css` overrides each one unlayered, which always wins. A variable counts as a
 * color when its name starts `--sl-color-` or any declaration of it holds a color literal; its effective
 * declarations (the unlayered ones, else the layered ones) must hold no literal and reach only
 * `--basalt-*` tokens the stylesheets declare (a reference to a token nothing defines paints as unset),
 * directly or through another audited variable.
 *
 *   bun apps/marketing/scripts/docs-palette.ts [dist-dir]   # default: apps/marketing/dist
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Declaration = { prop: string; value: string; layered: boolean };

const COMMENT = /\/\*[^]*?\*\//g;
const DECLARATION = /^\s*(--[\w-]+)\s*:\s*([^]*?)\s*$/;
const LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\b(?:white|black|red|green|blue|yellow|orange|purple|gray|grey|pink|cyan|magenta)\b/i;

/** Custom-property declarations of a stylesheet, each marked as sitting inside an `@layer` block or not. */
export function declarations(css: string): Declaration[] {
  const found: Declaration[] = [];
  const open: boolean[] = [];
  let buffer = "";
  let quote = "";
  let parens = 0;
  const flush = (): void => {
    const match = DECLARATION.exec(buffer);
    if (match !== null && open.length > 0) {
      found.push({ prop: match[1]!, value: match[2]!, layered: open.some(Boolean) });
    }
    buffer = "";
  };
  for (const ch of css.replace(COMMENT, "")) {
    if (quote !== "") {
      buffer += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") parens += 1;
    else if (ch === ")") parens -= 1;
    if (parens > 0 || quote !== "") {
      buffer += ch;
    } else if (ch === "{") {
      open.push(buffer.trim().startsWith("@layer"));
      buffer = "";
    } else if (ch === "}") {
      flush();
      open.pop();
    } else if (ch === ";") {
      flush();
    } else {
      buffer += ch;
    }
  }
  return found;
}

const hasLiteral = (value: string): boolean => LITERAL.test(value.replace(/url\([^)]*\)/g, ""));

/** The off-palette findings of the given stylesheets, one line each; empty when every color variable is basalt's. */
export function offPalette(
  sheets: readonly string[],
  tokenSheets: readonly string[] = sheets,
): string[] {
  const known = new Set(tokenSheets.flatMap(declarations).map(({ prop }) => prop));
  const all = sheets.flatMap(declarations).filter(({ prop }) => /^--(?:sl|ec)-/.test(prop));
  const byProp = Map.groupBy(all, ({ prop }) => prop);
  const effective = new Map<string, Declaration[]>();
  const audited = new Set<string>();
  for (const [prop, decls] of byProp) {
    const unlayered = decls.filter(({ layered }) => !layered);
    effective.set(prop, unlayered.length > 0 ? unlayered : decls);
    if (prop.startsWith("--sl-color-") || decls.some(({ value }) => hasLiteral(value)))
      audited.add(prop);
  }

  const problems = (value: string, seen: readonly string[]): string[] => {
    const out = hasLiteral(value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ""))
      ? ["color literal"]
      : [];
    for (const [, ref] of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (ref!.startsWith("--basalt-")) {
        if (!known.has(ref!)) out.push(`undefined token ${ref}`);
        continue;
      }
      const target = effective.get(ref!);
      if (target === undefined) out.push(`unknown variable ${ref}`);
      else if (!seen.includes(ref!)) {
        for (const decl of target) out.push(...problems(decl.value, [...seen, ref!]));
      }
    }
    return out;
  };

  const findings: string[] = [];
  for (const prop of audited) {
    for (const { value } of effective.get(prop)!) {
      const bad = [...new Set(problems(value, [prop]))];
      if (bad.length > 0) findings.push(`${prop}: ${value.slice(0, 80)} (${bad.join(", ")})`);
    }
  }
  return findings;
}

if (import.meta.main) {
  const dist = process.argv[2] ?? new URL("../dist", import.meta.url).pathname;
  const dir = join(dist, "_astro");
  const sheets = readdirSync(dir)
    // Starlight's print sheet (media="print") sets its own black-on-white scale, which is what paper wants.
    .filter((name) => name.endsWith(".css") && !name.startsWith("print."))
    .map((name) => readFileSync(join(dir, name), "utf8"));
  if (sheets.length === 0) throw new Error(`no CSS in ${dir}: build the site first`);
  const findings = offPalette(sheets);
  if (findings.length > 0) {
    console.error(
      `docs palette: ${findings.length} color variable(s) outside --basalt-*:\n${findings.join("\n")}`,
    );
    process.exit(1);
  }
  console.log(
    `docs palette: every Starlight and Expressive Code color variable in ${sheets.length} sheets resolves to --basalt-*`,
  );
}
