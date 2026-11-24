#!/usr/bin/env bun
/**
 * Which quality-matrix cells and which Astro-matrix parts a branch runs locally: `make quality-matrix-fast` and
 * `make astro-matrix-fast`, the two matrix steps of `make check-fast`. CI runs every cell and every part, sharded, on every
 * head, and `make merge-guard` refuses a head without that green run, so the local step only asks "did this branch break
 * the pages it reaches". A lead never runs the whole quality matrix locally; `make quality-matrix` and `make check` do.
 *
 * Quality matrix (default), per changed file:
 *
 *   - not a matrix input (QUALITY_INPUTS)                                   -> nothing
 *   - the matrix harness: its tests and support, or a module it imports    -> all
 *   - an additive diff of the scenario registry, the scenario info or the
 *     demo series (a new entry moves no page that does not use it)          -> the scenario routes it adds
 *   - a manifest or lockfile, a deleted file, a file the graph cannot read,
 *     or a module the app shell imports (every page renders it)            -> the smoke set
 *   - a module some pages import, through any chain (scripts/import-graph.ts) -> those pages
 *   - a source no page imports (a test, a CLI module)                      -> nothing
 *
 * The routes a change reaches run in full when they fit CAP_CELLS; a change that reaches more than half the pages runs the
 * smoke set (one route per part family, every cell of it); between the two, the smoke set plus an even sample of the
 * reached routes up to the cap. Nothing reached: skip.
 *
 * Astro matrix (`--astro`): the same rule over the parts of apps/playground-astro (src/parts/<family>/<id>.tsx, the graph
 * from each part's demo module); its scripts, config, registry and record are its harness (all), its layout and probe are
 * on every page (smoke), a family's index.ts selects that family. The package's build shape (its manifest and build config)
 * is the smoke set: the matrix measures the build.
 *
 * Usage: `bun scripts/matrix-select.ts [--astro] [--base <ref>]` prints `skip`, `all`, `routes <comma list>` (quality) or
 * `parts <comma list>` (--astro) on stdout and the reasons on stderr. The changed set is the merge base with `<ref>` (default
 * `origin/master`) through the working tree, untracked files included. No merge base: `all`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createImportGraph } from './import-graph'
import type { ImportGraph } from './import-graph'

/** Paths whose change can reach a quality-matrix page. */
export const QUALITY_INPUTS: readonly string[] = [
  'packages/basalt-ui/src',
  'packages/basalt-ui/tests/quality',
  'packages/basalt-ui/tests/support',
  'packages/basalt-ui/package.json',
  'apps/playground',
  'apps/expression',
  'package.json',
  'bun.lock',
]

/** Paths whose change can reach an Astro-matrix page: the package whole (the matrix measures its build). */
export const ASTRO_INPUTS: readonly string[] = [
  'packages/basalt-ui',
  'apps/playground/src/demo',
  'apps/playground-astro',
  'docs/v3/verdicts/astro-matrix.json',
  'package.json',
  'bun.lock',
]

/** The quality matrix's own code: a change to it can move every cell. */
export const QUALITY_HARNESS: readonly string[] = [
  'packages/basalt-ui/tests/quality',
  'packages/basalt-ui/tests/support',
]

/** The Astro matrix's own code: a change to it can move every part, and runs the smoke set locally (never every part). */
export const ASTRO_HARNESS: readonly string[] = [
  'apps/playground-astro/scripts',
  'apps/playground-astro/astro.config.mjs',
  'apps/playground-astro/package.json',
  'apps/playground-astro/tsconfig.json',
  'apps/playground-astro/src/parts/registry.ts',
  'apps/playground-astro/src/parts/types.ts',
  'apps/playground-astro/src/parts/findings.ts',
]
export const ASTRO_RECORD = 'docs/v3/verdicts/astro-matrix.json'

/** The package files outside src that shape its dist (the `build` script of its package.json): the build config and the post-build rewrites. */
export const BUILD_SHAPE: readonly string[] = [
  'packages/basalt-ui/package.json',
  'packages/basalt-ui/tsup.config.ts',
  'packages/basalt-ui/tsconfig.json',
  'packages/basalt-ui/tsconfig.build.json',
  'packages/basalt-ui/scripts/copy-assets.mjs',
  'packages/basalt-ui/scripts/rewrite-ui-specifiers.mjs',
  'packages/basalt-ui/scripts/fix-esm-extensions.mjs',
]

/**
 * One route per part family, at the matrix's two sampled cells and its two hover cells each (28 cells): the controls kit
 * (the primitives), the cards, the charts, the data table, the whole form, the authored MDX page and the expression app's
 * index (the only page of the second shell). Every other page renders a shell, so it needs no route of its own.
 */
export const SMOKE_ROUTES: readonly string[] = [
  '/cards',
  '/charts',
  '/kit/controls',
  '/kit/forms/whole',
  '/scenarios',
  '/scenarios/mdx',
  '/table',
]

/** One part per family of apps/playground-astro (FAMILIES in src/parts/types.ts). */
export const SMOKE_PARTS: readonly string[] = [
  'app-shell',
  'button',
  'data-table',
  'input',
  'lines',
  'markdown',
  'stat-card',
]

/**
 * The most cells a reached set runs locally: 48 cells at the 4.8 s a cell took under host load (2026-11-21) is under
 * four minutes, inside the five the matrix step is held to. The whole sampled matrix is CI's.
 */
export const CAP_CELLS = 48
/** The most Astro parts a reached set measures locally: the whole matrix is 90 parts in about five minutes. */
export const CAP_PARTS = 24

/** The two apps the quality matrix serves; each registers scenarios under `src/scenarios`. */
const APPS = ['apps/playground', 'apps/expression'] as const
type AppDir = (typeof APPS)[number]
const infoOf = (app: AppDir): string => `${app}/src/scenarios/scenario-info.ts`
const registryOf = (app: AppDir): string => `${app}/src/scenarios/registry.tsx`
const INFOS: readonly string[] = APPS.map(infoOf)
/** Files a new scenario adds lines to; an additive diff of one adds only the new scenario's page. */
const ADDITIVE: readonly string[] = APPS.flatMap((app) => [
  infoOf(app),
  registryOf(app),
  `${app}/src/demo/series.ts`,
])

/** Files the graph reads; a changed file of another kind (an image, a font, a config) it cannot place. */
const READABLE = /\.(?:[cm]?[jt]sx?|css|mdx|md|json|astro)$/
/** A manifest, lockfile or compiler config: it reaches every page without an import edge. */
export const MANIFEST =
  /(?:^|\/)(?:package\.json|bun\.lock|bunfig\.toml|tsconfig[^/]*\.json|vite\.config\.ts|index\.html)$/

/** A test or test-only module: no page imports one, deleted or not. */
const TEST = /\.(?:test|spec|cases|type-guard|type-test)\.[cm]?[jt]sx?$/

/** What a matrix's pages reach. A page is a quality-matrix route or an Astro part id. */
export interface PageModel {
  /** page -> every repo-relative file its render imports, through any chain */
  pages: ReadonlyMap<string, ReadonlySet<string>>
  /** the files every page imports (the app shell, the Astro layout): a change to one reaches all */
  shared: ReadonlySet<string>
  /** the matrix's own code, and what it imports */
  harness: ReadonlySet<string>
  /** what one page costs to run: cells for the quality matrix, 1 for an Astro part */
  cost: (page: string) => number
}

export type Selection =
  | { mode: 'skip'; reasons: string[] }
  | { mode: 'all'; reasons: string[] }
  | { mode: 'pages'; pages: string[]; cost: number; reasons: string[] }

export interface SelectInput {
  /** repo-relative paths changed on the branch (committed, staged, unstaged, untracked) */
  changed: readonly string[]
  /** the unified=0 diff of a changed file against the merge base; read only for the ADDITIVE files */
  diffOf: (file: string) => string
  /** whether a changed path is still in the working tree (a deleted file the graph no longer sees) */
  exists: (file: string) => boolean
  model: PageModel
}

const under = (file: string, paths: readonly string[]): boolean =>
  paths.some((path) => file === path || file.startsWith(`${path}/`))

/** No `-` line in the diff: nothing was removed or rewritten. */
function additiveOnly(diff: string): boolean {
  return !diff.split('\n').some((line) => line.startsWith('-') && !line.startsWith('---'))
}

/** The ids a diff adds to scenario-info.ts (`+    id: 'expr-n87',`). */
function addedIds(diff: string): string[] {
  return [...diff.matchAll(/^\+\s*id:\s*'([\w-]+)'/gm)].map((m) => m[1] as string)
}

/** `count` items of `list`, evenly spaced, the first included. */
function spread<T>(list: readonly T[], count: number): T[] {
  if (count >= list.length) return [...list]
  const step = list.length / count
  return Array.from({ length: count }, (_, i) => list[Math.floor(i * step)] as T)
}

type Special = { pages: string[]; reason: string; smoke?: true }

interface Rules {
  inputs: readonly string[]
  harness: readonly string[]
  smoke: readonly string[]
  cap: number
  /** a rule for one changed file before the graph: the pages it names or the smoke set, or `null` to ask the graph */
  special?: (file: string, input: SelectInput) => Special | null
}

/** The shared rule of both matrices: the walk over the changed files, then the cap and the smoke set. */
function select(input: SelectInput, rules: Rules): Selection {
  const { model } = input
  const changed = input.changed.filter((file) => under(file, rules.inputs))
  if (changed.length === 0) return { mode: 'skip', reasons: ['no matrix input changed'] }
  const reached = new Set<string>()
  const reasons: string[] = []
  let smoke = ''
  for (const file of changed) {
    if (under(file, rules.harness) || model.harness.has(file))
      return { mode: 'all', reasons: [`the matrix harness changed: ${file}`] }
    const special = rules.special?.(file, input)
    if (special) {
      if (special.smoke) smoke ||= `${file}: ${special.reason}`
      else reasons.push(`${file}: ${special.reason}`)
      for (const page of special.pages) reached.add(page)
      continue
    }
    if (MANIFEST.test(file)) smoke ||= `${file} reaches every page without an import`
    else if (TEST.test(file)) reasons.push(`${file}: a test, no page imports it`)
    else if (!input.exists(file)) smoke ||= `${file} was deleted`
    else if (!READABLE.test(file)) smoke ||= `the graph cannot read ${file}`
    else if (model.shared.has(file)) smoke ||= `every page reaches ${file}`
    else {
      const pages = [...model.pages].filter(([, files]) => files.has(file)).map(([page]) => page)
      for (const page of pages) reached.add(page)
      reasons.push(
        `${file}: ${pages.length === 0 ? 'no page imports it' : `${pages.length} pages`}`,
      )
    }
  }
  const all = model.pages.size
  if (reached.size > all / 2) smoke ||= `the change reaches ${reached.size} of ${all} pages`
  const sum = (pages: Iterable<string>): number =>
    [...pages].reduce((total, page) => total + model.cost(page), 0)
  const picked = new Set<string>(smoke ? rules.smoke : [])
  if (smoke) reasons.push(`smoke set: ${smoke}`)
  const rest = [...reached].filter((page) => !picked.has(page)).toSorted()
  if (!smoke || reached.size <= all / 2) {
    if (sum(picked) + sum(rest) <= rules.cap) for (const page of rest) picked.add(page)
    else {
      if (!smoke) for (const page of rules.smoke) picked.add(page)
      const room = rest.filter((page) => !picked.has(page))
      let count = room.length
      while (count > 0 && sum(picked) + sum(spread(room, count)) > rules.cap) count -= 1
      for (const page of spread(room, count)) picked.add(page)
      reasons.push(
        `${reached.size} pages reached, over the cap of ${rules.cap}: the smoke set and ${count} of them`,
      )
    }
  }
  if (picked.size === 0)
    return { mode: 'skip', reasons: [...reasons, 'no page reaches the change'] }
  const pages = [...picked].toSorted()
  return { mode: 'pages', pages, cost: sum(pages), reasons }
}

/** The quality-matrix rule: the scenario registry's additive diffs name their routes, the rest is the graph. */
export function selectMatrix(input: SelectInput): Selection {
  return select(input, {
    inputs: QUALITY_INPUTS,
    harness: QUALITY_HARNESS,
    smoke: SMOKE_ROUTES,
    cap: CAP_CELLS,
    special: (file, { diffOf }) => {
      if (!ADDITIVE.includes(file)) return null
      const diff = diffOf(file)
      if (!additiveOnly(diff)) return null
      const routes = INFOS.includes(file) ? addedIds(diff).map((id) => `/scenarios/${id}`) : []
      return { pages: routes, reason: `additive lines, ${routes.length} new scenario routes` }
    },
  })
}

/** The ids of the parts whose line of the record a diff adds or removes (the record is one part per line). */
function recordParts(diff: string): { ids: string[]; other: boolean } {
  const ids: string[] = []
  let other = false
  for (const line of diff.split('\n')) {
    if (!/^[+-]/.test(line) || /^(?:\+\+\+|---)/.test(line)) continue
    const id = /^[+-]\s*\{"id":\s*"([\w-]+)"/.exec(line)?.[1]
    if (id === undefined) other = true
    else ids.push(id)
  }
  return { ids: [...new Set(ids)], other }
}

/**
 * The Astro-matrix rule: a family's index selects the family, a record line its part, the matrix's own code and the
 * package's build shape the smoke set; a package file outside src and the build shape (a test, a doc, a gate) none.
 */
export function selectAstro(
  input: SelectInput,
  families: ReadonlyMap<string, readonly string[]>,
): Selection {
  return select(input, {
    inputs: ASTRO_INPUTS,
    harness: [],
    smoke: SMOKE_PARTS,
    cap: CAP_PARTS,
    special: (file, { diffOf }) => {
      if (under(file, ASTRO_HARNESS))
        return { pages: [], reason: "the matrix's own code", smoke: true }
      if (BUILD_SHAPE.includes(file)) return { pages: [], reason: 'shapes the build', smoke: true }
      if (file === ASTRO_RECORD) {
        const { ids, other } = recordParts(diffOf(file))
        if (other)
          return { pages: ids, reason: 'a record line beside its parts changed', smoke: true }
        return { pages: ids, reason: `the record of ${ids.length} parts` }
      }
      const family = /^apps\/playground-astro\/src\/parts\/([\w-]+)\/index\.ts$/.exec(file)?.[1]
      if (family !== undefined)
        return {
          pages: [...(families.get(family) ?? [])],
          reason: `the ${family} family's entries`,
        }
      if (file.startsWith('packages/basalt-ui/') && !file.startsWith('packages/basalt-ui/src/'))
        return { pages: [], reason: 'not part of the build' }
      return null
    },
  })
}

// ── the real tree ─────────────────────────────────────────────────────────────────────────────────

const routesOf = (app: AppDir): string => `${app}/src/routes`
/** The generated route tree imports every route: the walk from main.tsx stops there, the routes are walked one by one. */
const routeTreeOf = (app: AppDir): string => `${app}/src/routeTree.gen.ts`

/** Route files of an app, relative to its routes dir without `.tsx`, skipping the `__`/`-` entries TanStack's generator ignores. */
function routeNames(root: string, app: AppDir, prefix = ''): string[] {
  return readdirSync(join(root, routesOf(app), prefix), { withFileTypes: true }).flatMap(
    (entry) => {
      if (entry.name.startsWith('__') || entry.name.startsWith('-')) return []
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) return routeNames(root, app, rel)
      return entry.name.endsWith('.tsx') ? [rel.slice(0, -'.tsx'.length)] : []
    },
  )
}

const segments = (name: string): string[] =>
  name
    .split(/[./]/)
    .filter((part, i, all) => !((part === 'index' || part === 'route') && i === all.length - 1))

/** The route files a route renders inside: itself and every layout above it (`x.tsx` or `x/route.tsx` above `x/y`). */
function layoutsOf(name: string, names: readonly string[]): string[] {
  const own = segments(name)
  return names.filter((other) => {
    if (other === name) return true
    if (other.endsWith('/index') || other === 'index') return false
    const theirs = segments(other)
    return theirs.length <= own.length && theirs.every((part, i) => part === own[i])
  })
}

/** The ids of an app's scenario-info.ts, in order: the playground's first is the matrix's `/scenarios/$name`. */
function scenarioIds(root: string, app: AppDir): string[] {
  return [...readFileSync(join(root, infoOf(app)), 'utf8').matchAll(/\bid:\s*'([\w-]+)'/g)].map(
    (m) => m[1] as string,
  )
}

/** registry.tsx: `'expr-n87': (p) => <ExprN87Scenario` and `import { ExprN87Scenario } from './expr/n87/ExprN87'`. */
function scenarioModules(root: string, app: AppDir, graph: ImportGraph): Map<string, string> {
  const registry = registryOf(app)
  const source = readFileSync(join(root, registry), 'utf8')
  const from = new Map<string, string>()
  for (const m of source.matchAll(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)'/gm))
    for (const name of (m[1] as string).split(',')) from.set(name.trim(), m[2] as string)
  const out = new Map<string, string>()
  for (const m of source.matchAll(/^\s*'?([\w-]+)'?:\s*\([^)]*\)\s*=>\s*<(\w+)/gm)) {
    const specifier = from.get(m[2] as string)
    const file = specifier === undefined ? null : graph.resolve(registry, specifier)
    if (file !== null) out.set(m[1] as string, file)
  }
  return out
}

/**
 * The quality matrix over the working tree: every route of routes.ts and every scenario, as the matrix names them. The
 * playground serves its route files and its scenarios, the expression app its index and its scenarios (the route
 * `/scenarios` is the expression index, the only route file of that app the matrix samples).
 */
export function qualityModel(root: string): PageModel & { unresolved: string[]; ids: string[] } {
  const graph = createImportGraph(root)
  const ids = scenarioIds(root, 'apps/playground')
  const shared = new Set<string>()
  const pages = new Map<string, Set<string>>()
  /** quality-matrix cells per route: two per occurrence in routes.ts (a `x.tsx` and `x/index.tsx` share a path) */
  const sampled = new Map<string, number>()
  const add = (path: string, files: Iterable<string>): void => {
    const set = pages.get(path) ?? new Set<string>()
    for (const file of files) set.add(file)
    pages.set(path, set)
  }
  for (const app of APPS) {
    const routes = routesOf(app)
    const registry = registryOf(app)
    const names = routeNames(root, app).toSorted()
    for (const file of graph.reach(
      [`${app}/src/main.tsx`, `${routes}/__root.tsx`],
      new Set([routeTreeOf(app)]),
    ))
      shared.add(file)
    shared.delete(routeTreeOf(app))
    const stop = new Set([registry])
    // The expression app's matrix routes are its index alone: its `/` redirects and its scenarios are hover pages.
    const matrixNames =
      app === 'apps/playground' ? names : names.filter((n) => n === 'scenarios.index')
    for (const name of matrixNames) {
      // the path routes.ts gives a route file: only a trailing `index` is dropped
      const path = `/${name
        .split(/[./]/)
        .filter((part, i, all) => !(part === 'index' && i === all.length - 1))
        .map((part) => (part === '$name' ? ids[0] : part === '$id' ? '12' : part))
        .join('/')}`
      sampled.set(path, (sampled.get(path) ?? 0) + 2)
      add(
        path,
        graph.reach(
          layoutsOf(name, names).map((n) => `${routes}/${n}.tsx`),
          stop,
        ),
      )
    }
    const scenarioRoute = graph.reach([`${routes}/scenarios.$name.tsx`], stop)
    const modules = scenarioModules(root, app, graph)
    for (const id of scenarioIds(root, app)) {
      const module = modules.get(id)
      add(`/scenarios/${id}`, [
        ...scenarioRoute,
        ...(module === undefined ? [registry] : graph.reach([module])),
      ])
    }
  }
  // what every cell runs besides the page: the assertions (`quality.*`) and the document's pre-paint script
  const harness = graph.reach(
    ['assertions.ts', 'harness.ts'].map((f) => `packages/basalt-ui/tests/quality/matrix/${f}`),
  )
  return {
    pages,
    shared,
    harness: new Set([...harness].filter((file) => file.startsWith('packages/basalt-ui/src/'))),
    // the hover guard runs every page at two widths; routes.ts's routes add their two sampled cells each
    cost: (page) => 2 + (sampled.get(page) ?? 0),
    unresolved: graph.unresolved().filter((entry) => !entry.endsWith('./routeTree.gen')),
    ids,
  }
}

const ASTRO = 'apps/playground-astro/src'

/** The Astro matrix over the working tree: every part's demo module, the layout and probe every page imports. */
export function astroModel(root: string): PageModel & {
  unresolved: string[]
  families: Map<string, string[]>
} {
  const graph = createImportGraph(root)
  const pages = new Map<string, Set<string>>()
  const families = new Map<string, string[]>()
  for (const family of readdirSync(join(root, ASTRO, 'parts'), { withFileTypes: true })) {
    if (!family.isDirectory()) continue
    const index = readFileSync(join(root, ASTRO, 'parts', family.name, 'index.ts'), 'utf8')
    for (const m of index.matchAll(
      /\bid:\s*'([\w-]+)',\s*family:\s*'([\w-]+)',\s*module:\s*'([^']+)'/g,
    )) {
      const [, id, fam, module] = m as unknown as [string, string, string, string]
      const entry = graph.resolve(`${ASTRO}/parts/index.ts`, `./${module}`)
      pages.set(id, graph.reach(entry === null ? [] : [entry]))
      families.set(fam, [...(families.get(fam) ?? []), id])
    }
  }
  const shared = graph.reach([
    `${ASTRO}/layouts/Part.astro`,
    `${ASTRO}/lib/probe.ts`,
    `${ASTRO}/parts/baseline.tsx`,
  ])
  return {
    pages,
    shared,
    harness: new Set(),
    cost: () => 1,
    unresolved: graph.unresolved(),
    families,
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────

function git(args: string[]): string | null {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  return r.status === 0 ? r.stdout : null
}

if (import.meta.main) {
  const astro = process.argv.includes('--astro')
  const flag = process.argv.indexOf('--base')
  const base = flag > -1 ? (process.argv[flag + 1] ?? 'origin/master') : 'origin/master'
  const root = git(['rev-parse', '--show-toplevel'])?.trim()
  if (!root) {
    console.error('matrix-select: not a git checkout')
    process.exit(2)
  }
  process.chdir(root)
  const name = astro ? 'astro-matrix' : 'quality-matrix'
  const mergeBase = git(['merge-base', base, 'HEAD'])?.trim()
  let selection: Selection
  if (!mergeBase) {
    selection = { mode: 'all', reasons: [`no merge base with ${base}`] }
  } else {
    const changed = new Set<string>()
    for (const args of [
      ['diff', '--name-only', mergeBase],
      ['ls-files', '--others', '--exclude-standard'],
    ]) {
      for (const line of (git(args) ?? '').split('\n')) if (line) changed.add(line)
    }
    const input = {
      changed: [...changed],
      exists: (file: string) => existsSync(file),
      // an untracked additive file has no diff against the base: its whole text is new
      diffOf: (file: string) =>
        git(['diff', '--unified=0', mergeBase, '--', file]) ??
        (existsSync(file) ? readFileSync(file, 'utf8') : ''),
    }
    const inputs = astro ? ASTRO_INPUTS : QUALITY_INPUTS
    if (!input.changed.some((file) => under(file, inputs))) {
      selection = { mode: 'skip', reasons: ['no matrix input changed'] }
    } else if (astro) {
      const model = astroModel(root)
      selection = selectAstro({ ...input, model }, model.families)
    } else {
      selection = selectMatrix({ ...input, model: qualityModel(root) })
    }
  }
  for (const reason of selection.reasons) console.error(`${name}: ${reason}`)
  if (selection.mode === 'pages') {
    console.error(
      `${name}: ${astro ? `${selection.cost} parts` : `${selection.pages.length} routes, ${selection.cost} cells`}; CI runs every one`,
    )
    for (const page of selection.pages) console.error(`  ${page}`)
    console.log(`${astro ? 'parts' : 'routes'} ${selection.pages.join(',')}`)
  } else {
    console.error(`${name}: ${selection.mode}; CI runs every ${astro ? 'part' : 'cell'}`)
    console.log(selection.mode)
  }
}
