/// <reference types="bun" />
/**
 * The site's performance numbers, measured on the built `dist`, never claimed: per page the module
 * JavaScript it loads (gzip, with its static imports), its islands, the inline head scripts and its
 * stylesheets (gzip); the cost of the React runtime the first island brings and of each further
 * island's own chunk; with `--browser`, LCP and CLS on three page types in a headless Chrome, and the
 * layout shift of every guide at 1440 and 390 px (`guideCls`, held at 0).
 *
 *   bun apps/marketing/scripts/measure.ts            # print the numbers
 *   bun apps/marketing/scripts/measure.ts --check    # exit 1 when a number breaks site-budgets.json
 *   bun apps/marketing/scripts/measure.ts --write    # record the numbers as the new budgets
 *
 * Run `bun run build` in apps/marketing first. `--browser` needs `make browser-shell`.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const APP = join(import.meta.dir, "..");
const DIST = join(APP, "dist");
const BUDGETS = join(APP, "site-budgets.json");
const args = new Set(process.argv.slice(2));

/** The pages LCP and CLS are taken on: a landing page, an article and a Starlight docs page. */
const BROWSER_PAGES = ["/", "/guides/content-sites/", "/docs/introduction/"] as const;
/** Pages that ship JavaScript on purpose: Starlight's docs (search, menu), the chart island and the MDX islands page. */
const SCRIPTED = [/^\/docs\//, /^\/404\//, /^\/charts\//, /^\/guides\/islands-in-mdx\//];

const gz = (text: string | Buffer): number => gzipSync(text).byteLength;

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) pages(path, out);
    else if (name === "index.html" || name === "404.html") out.push(path);
  }
  return out;
}

const route = (file: string): string => {
  const rel = relative(DIST, file)
    .replace(/index\.html$/, "")
    .replace(/404\.html$/, "404/");
  return `/${rel}`;
};

/** A module and every module it imports statically, each counted once. */
function closure(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry) || !existsSync(entry)) return seen;
  seen.add(entry);
  const code = readFileSync(entry, "utf8");
  for (const m of code.matchAll(/(?:import|from)\s*["']([^"']+\.js)["']/g)) {
    const spec = m[1] ?? "";
    const next = spec.startsWith("/") ? join(DIST, spec) : join(dirname(entry), spec);
    closure(next, seen);
  }
  return seen;
}

const fileOf = (src: string): string => join(DIST, src.replace(/^\//, ""));
const sumGz = (files: Iterable<string>): number =>
  [...files].reduce((n, f) => n + gz(readFileSync(f)), 0);

type PageNumbers = {
  route: string;
  moduleScripts: number;
  islands: number;
  moduleJsGzip: number;
  /** The page's scripts and the React renderer with what they import: the cost the first island brings. */
  runtimeGzip: number;
  inlineJsGzip: number;
  cssGzip: number;
};

function measurePage(file: string): PageNumbers & { modules: Set<string>; islandChunks: string[] } {
  const html = readFileSync(file, "utf8");
  const srcs = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map(
    (m) => m[1] ?? "",
  );
  const islandChunks = [...html.matchAll(/component-url="([^"]+)"/g)].map((m) =>
    fileOf(m[1] ?? ""),
  );
  const rendererChunks = [...html.matchAll(/renderer-url="([^"]+)"/g)].map((m) =>
    fileOf(m[1] ?? ""),
  );
  const runtime = new Set<string>();
  for (const entry of [...srcs.map(fileOf), ...rendererChunks]) closure(entry, runtime);
  const modules = new Set<string>(runtime);
  for (const entry of islandChunks) closure(entry, modules);
  const inline = [
    ...html.matchAll(
      /<script(?![^>]*(?:src=|type="application\/ld\+json"))[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ]
    .map((m) => m[1] ?? "")
    .join(";");
  const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) =>
    fileOf(m[1] ?? ""),
  );
  const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1] ?? "")
    .join("");
  return {
    route: route(file),
    moduleScripts: srcs.length + (islandChunks.length > 0 ? 1 : 0),
    islands: (html.match(/<astro-island/g) ?? []).length,
    moduleJsGzip: sumGz(modules),
    runtimeGzip: sumGz(runtime),
    inlineJsGzip: inline.trim() === "" ? 0 : gz(inline),
    cssGzip: sumGz(css.filter(existsSync)) + (inlineCss === "" ? 0 : gz(inlineCss)),
    modules,
    islandChunks,
  };
}

async function browserNumbers(): Promise<Record<string, { lcpMs: number; cls: number }>> {
  const { chromium } = await import("playwright-core");
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname);
      const file = [join(DIST, path), join(DIST, path, "index.html")].find(
        (f) => existsSync(f) && statSync(f).isFile(),
      );
      return file === undefined
        ? new Response("not found", { status: 404 })
        : new Response(Bun.file(file));
    },
  });
  const browser = await chromium.launch();
  const out: Record<string, { lcpMs: number; cls: number }> = {};
  try {
    for (const path of BROWSER_PAGES) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(`http://localhost:${server.port}${path}`, { waitUntil: "networkidle" });
      out[path] = await page.evaluate(
        () =>
          new Promise<{ lcpMs: number; cls: number }>((resolve) => {
            let lcp = 0;
            let cls = 0;
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) lcp = e.startTime;
            }).observe({ type: "largest-contentful-paint", buffered: true });
            new PerformanceObserver((list) => {
              for (const e of list.getEntries() as (PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
              })[]) {
                if (!e.hadRecentInput) cls += e.value;
              }
            }).observe({ type: "layout-shift", buffered: true });
            setTimeout(
              () => resolve({ lcpMs: Math.round(lcp), cls: Math.round(cls * 1000) / 1000 }),
              500,
            );
          }),
      );
      await page.close();
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
  return out;
}

/**
 * The layout shift of every guide: each is loaded in a viewport as tall as the page (so every shift is in
 * view and every island hydrates at once) at 1440 and 390 px, with its scripts held back so the static
 * picture paints first, and the shift is read once the islands are in, counting from the moment the faces are loaded. A guide is held at 0.
 */
async function guideShift(routes: readonly string[]): Promise<Record<string, number>> {
  const { chromium } = await import("playwright-core");
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname);
      const file = [join(DIST, path), join(DIST, path, "index.html")].find(
        (f) => existsSync(f) && statSync(f).isFile(),
      );
      return file === undefined
        ? new Response("not found", { status: 404 })
        : new Response(Bun.file(file));
    },
  });
  const browser = await chromium.launch();
  const out: Record<string, number> = {};
  try {
    for (const path of routes) {
      let worst = 0;
      for (const width of [1440, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 6000 } });
        await page.addInitScript(() => {
          const w = window as unknown as { __cls: number; __from: number };
          w.__cls = 0;
          w.__from = Number.POSITIVE_INFINITY;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as {
              value: number;
              hadRecentInput: boolean;
              startTime: number;
            }[])
              if (!e.hadRecentInput && e.startTime >= w.__from) w.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        await page.route(/\.js(\?|$)/, async (request) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await request.continue();
        });
        await page.goto(`http://localhost:${server.port}${path}`, { waitUntil: "load" });
        // A late font swap moves text on a slow host whatever a page does: a shift counts from the moment the faces are in.
        await page.evaluate(async () => {
          await document.fonts.ready;
          (window as unknown as { __from: number }).__from = performance.now();
        });
        await page.waitForTimeout(3100);
        worst = Math.max(
          worst,
          await page.evaluate(() => (window as unknown as { __cls: number }).__cls),
        );
        await page.close();
      }
      out[path] = worst;
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
  return out;
}

type Budgets = {
  staticModuleJsGzip: number;
  inlineJsGzip: number;
  reactRuntimeGzip: number;
  furtherIslandGzip: number;
  mdxIslandsGzip: number;
  cssGzipPerPage: number;
  lcpMs: number;
  cls: number;
  guideCls: number;
};

if (!existsSync(DIST)) {
  console.error("no dist: run `bun run build` in apps/marketing first");
  process.exit(1);
}

const measured = pages(DIST).map(measurePage);
const statics = measured.filter((p) => !SCRIPTED.some((r) => r.test(p.route)));
/** What a page's islands add to the runtime the first one brings, whatever chunks Vite split them into. */
const further = (p: PageNumbers | undefined): number =>
  p === undefined ? 0 : p.moduleJsGzip - p.runtimeGzip;
const islandPage = measured.find((p) => p.route === "/charts/");
const mdxPage = measured.find((p) => p.route === "/guides/islands-in-mdx/");
if (islandPage === undefined || mdxPage === undefined) {
  console.error(
    "the island pages /charts/ and /guides/islands-in-mdx/ must be built: the island budgets read them",
  );
  process.exit(1);
}
const numbers: Budgets = {
  staticModuleJsGzip: Math.max(0, ...statics.map((p) => p.moduleJsGzip)),
  inlineJsGzip: Math.max(0, ...measured.map((p) => p.inlineJsGzip)),
  reactRuntimeGzip: islandPage?.runtimeGzip ?? 0,
  furtherIslandGzip: further(islandPage),
  mdxIslandsGzip: further(mdxPage),
  cssGzipPerPage: Math.max(0, ...measured.map((p) => p.cssGzip)),
  lcpMs: 0,
  cls: 0,
  guideCls: 0,
};

console.log("route\tislands\tmodule JS gz\tinline JS gz\tCSS gz");
for (const p of measured.toSorted((a, b) => a.route.localeCompare(b.route))) {
  console.log(`${p.route}\t${p.islands}\t${p.moduleJsGzip}\t${p.inlineJsGzip}\t${p.cssGzip}`);
}
if (args.has("--browser")) {
  const vitals = await browserNumbers();
  for (const [path, v] of Object.entries(vitals))
    console.log(`${path}\tLCP ${v.lcpMs} ms\tCLS ${v.cls}`);
  numbers.lcpMs = Math.max(...Object.values(vitals).map((v) => v.lcpMs));
  numbers.cls = Math.max(...Object.values(vitals).map((v) => v.cls));
  const shifts = await guideShift(
    measured.map((p) => p.route).filter((r) => r.startsWith("/guides/") && r !== "/guides/"),
  );
  for (const [path, value] of Object.entries(shifts)) console.log(`${path}\tguide CLS ${value}`);
  numbers.guideCls = Math.max(0, ...Object.values(shifts));
}
console.log(JSON.stringify(numbers, null, 2));

if (args.has("--write")) writeFileSync(BUDGETS, `${JSON.stringify(numbers, null, 2)}\n`);

if (args.has("--check")) {
  const budgets = JSON.parse(readFileSync(BUDGETS, "utf8")) as Budgets;
  const browserKeys = new Set(["lcpMs", "cls", "guideCls"]);
  const over = (Object.keys(budgets) as (keyof Budgets)[])
    .filter((k) => args.has("--browser") || !browserKeys.has(k))
    .filter((k) => numbers[k] > budgets[k]);
  for (const k of over) console.error(`over budget: ${k} ${numbers[k]} > ${budgets[k]}`);
  if (over.length > 0) process.exit(1);
  console.log("site budgets: every number within its budget");
}
