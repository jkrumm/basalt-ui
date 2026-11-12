// Spike f2-route (docs/v3/ARCHITECTURE.md section 11 F2): one argo dashboard route ported against
// the frozen contract. This file is the harness around the port in src/:
//
//   bun run.ts          report: one JSON object on stdout (exit 0 = harness ran, not hypothesis held)
//   bun run.ts shot     build with vite, serve dist and shoot the route at 1800x1200 and 390x844,
//                       light and dark, into shots/
//
// The report runs `tsc --noEmit -p .`, scans the port's imports against the section 3 subpath list,
// and checks the hand list results/needs.json (every entry names a file, a line and the text that
// must sit on it, so the list cannot drift from the code). It runs no model and writes nothing.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, 'src')
const SHOTS = join(HERE, 'shots')

/** ARCHITECTURE section 3: the published subpaths a port may name (CSS entries and `ui/*` included). */
const SUBPATHS = new Set([
  'basalt-ui',
  'basalt-ui/router',
  'basalt-ui/data',
  'basalt-ui/page',
  'basalt-ui/shell',
  'basalt-ui/cards',
  'basalt-ui/controls',
  'basalt-ui/table',
  'basalt-ui/charts',
  'basalt-ui/content',
  'basalt-ui/ai',
  'basalt-ui/vite',
  'basalt-ui/lint',
  'basalt-ui/stylelint',
  'basalt-ui/testing',
  'basalt-ui/tokens.css',
  'basalt-ui/typography.css',
  'basalt-ui/prose.css',
  'basalt-ui/fonts.css',
  'basalt-ui/tailwind.css',
  'basalt-ui/theme-script',
])
/** The 36 modules of the primitives paragraph. */
const PRIMITIVES = new Set(
  'button input textarea number-field select combobox checkbox radio-group switch slider segmented field dialog sheet popover tooltip menu toast tabs accordion collapsible card table scroll-area separator skeleton badge status alert kbd progress meter toolbar num date-picker virtual-list'.split(
    ' ',
  ),
)

const isPublished = (specifier: string): boolean =>
  SUBPATHS.has(specifier) ||
  (specifier.startsWith('basalt-ui/ui/') && PRIMITIVES.has(specifier.slice('basalt-ui/ui/'.length)))

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )
}

type Import = { file: string; line: number; specifier: string; names: string[] }

function importsOf(file: string): Import[] {
  const text = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true)
  const out: Import[] = []
  sf.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const clause = node.importClause
    const names: string[] = []
    if (clause?.name !== undefined) names.push('default')
    const bindings = clause?.namedBindings
    if (bindings !== undefined && ts.isNamespaceImport(bindings)) names.push('*')
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) names.push((el.propertyName ?? el.name).text)
    }
    out.push({
      file: relative(HERE, file),
      line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      specifier: node.moduleSpecifier.text,
      names,
    })
  })
  return out
}

type Need = {
  id: string
  file: string
  line: number
  anchor: string
  /** What the route did, in one clause. */
  need: string
  /** The Must-not column or app-row clause it hits, or null when the contract only lacks a shape. */
  forbidden: string | null
  decision: 'amend' | 'port' | 'none'
  shape: string
}

function checkNeeds(): { needs: Need[]; drift: string[] } {
  const needs = JSON.parse(readFileSync(join(HERE, 'results', 'needs.json'), 'utf8')) as Need[]
  const drift: string[] = []
  for (const n of needs) {
    const lines = readFileSync(join(HERE, n.file), 'utf8').split('\n')
    if (!(lines[n.line - 1] ?? '').includes(n.anchor)) drift.push(`${n.id}: ${n.file}:${n.line}`)
  }
  return { needs, drift }
}

function report(): void {
  const tsc = spawnSync(join(HERE, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', '.'], {
    cwd: HERE,
    encoding: 'utf8',
  })
  const imports = walk(SRC)
    .filter((f) => /\.tsx?$/.test(f))
    .flatMap(importsOf)
  const own = imports.filter(
    (i) => i.specifier === 'basalt-ui' || i.specifier.startsWith('basalt-ui/'),
  )
  // CSS `@import` lines count as imports: a sheet outside the published CSS entries is a deep import.
  const cssDeep = walk(SRC)
    .filter((f) => f.endsWith('.css'))
    .flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((text, i) => {
          const m = /^@import\s+['"]([^'"]+)['"]/.exec(text)
          const spec = m?.[1]
          if (spec === undefined || (isPublished(spec) && spec.startsWith('basalt-ui'))) return []
          return spec.startsWith('basalt-ui') || spec.includes('packages/basalt-ui')
            ? [{ file: relative(HERE, f), line: i + 1, specifier: spec, names: [] as string[] }]
            : []
        }),
    )
  const deepImports = [...own.filter((i) => !isPublished(i.specifier)), ...cssDeep]
  const { needs, drift } = checkNeeds()
  const edgesForbidden = needs.filter((n) => n.forbidden !== null)
  const ejects = walk(SRC).filter((f) => /basalt:ejected/.test(readFileSync(f, 'utf8'))).length
  const layers = {
    table: own.some((i) => i.specifier === 'basalt-ui/table'),
    sparkline: own.some((i) => i.specifier === 'basalt-ui/charts' && i.names.includes('Sparkline')),
    statGroup: own.some((i) => i.specifier === 'basalt-ui/cards' && i.names.includes('StatGroup')),
    filterSet: own.some(
      (i) => i.specifier === 'basalt-ui/controls' && i.names.includes('FilterSet'),
    ),
    queryClient: own.some(
      (i) => i.specifier === 'basalt-ui/data' && i.names.includes('makeQueryClient'),
    ),
  }
  const clean =
    tsc.status === 0 && edgesForbidden.length === 0 && deepImports.length === 0 && ejects === 0
  console.log(
    JSON.stringify({
      spike: 'f2-route',
      route: 'argo apps/dashboard/src/routes/strength-tracker.tsx',
      tsc: { exit: tsc.status, errors: (tsc.stdout.match(/error TS\d+/g) ?? []).length },
      layers,
      stubs: Object.entries(
        (
          JSON.parse(
            readFileSync(join(HERE, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
          ) as {
            compilerOptions: { paths: Record<string, string[]> }
          }
        ).compilerOptions.paths,
      )
        .filter(([, to]) => to[0]?.startsWith('./stubs/') === true)
        .map(([from, to]) => `${from} -> ${to[0]}`),
      subpaths: [...new Set(own.map((i) => i.specifier))].sort(),
      deepImports: deepImports.length,
      deepImportList: deepImports.map((i) => `${i.file}:${i.line} ${i.specifier}`),
      ejects,
      needs: needs.map((n) => ({
        id: n.id,
        at: `${n.file}:${n.line}`,
        need: n.need,
        decision: n.decision,
      })),
      edgesForbidden: edgesForbidden.map((n) => ({
        id: n.id,
        at: `${n.file}:${n.line}`,
        hits: n.forbidden,
        decision: n.decision,
        shape: n.shape,
      })),
      needsDrift: drift,
      verdict: clean ? 'F2: PASS' : 'F2: REFUTED',
    }),
  )
}

async function shot(): Promise<void> {
  const { chromium } = await import('playwright-core')
  const build = spawnSync(join(HERE, 'node_modules', '.bin', 'vite'), ['build'], {
    cwd: HERE,
    encoding: 'utf8',
  })
  if (build.status !== 0) throw new Error(`build failed:\n${build.stdout}${build.stderr}`)
  const dist = join(HERE, 'dist')
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname
      const file = Bun.file(join(dist, path === '/' ? 'index.html' : path))
      return file.size > 0 ? new Response(file) : new Response('not found', { status: 404 })
    },
  })
  const round = process.argv[3] ?? '1'
  const out = join(SHOTS, `r${round}`)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const viewports = [
    { name: 'desktop', width: 1800, height: 1200 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const
  const tabs = ['charts', 'history'] as const
  const browser = await chromium.launch({ channel: 'chrome' })
  const result: Record<string, unknown> = {}
  try {
    for (const vp of viewports) {
      for (const scheme of ['light', 'dark'] as const) {
        for (const tab of tabs) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
          })
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
          page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
          await page.goto(
            `http://localhost:${server.port}/?scheme=${scheme}&q=${encodeURIComponent(`tab=${tab}`)}`,
            { waitUntil: 'networkidle' },
          )
          await page.evaluate(() => document.fonts.ready)
          await page.waitForTimeout(400)
          const name = `${tab}.${vp.name}.${scheme}`
          await page.screenshot({ path: join(out, `${name}.png`), fullPage: true })
          result[name] = {
            errors,
            scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
            clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
          }
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
    server.stop(true)
  }
  console.log(JSON.stringify(result))
}

if (process.argv[2] === 'shot') await shot()
else report()
