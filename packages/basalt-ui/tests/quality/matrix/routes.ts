/**
 * The matrix route list, read from each app's source at run time: a route added to the playground's routes
 * directory, or a scenario added to either app's registry, joins the matrix with no edit here
 * (quality-contract section 4). Two apps are served: the playground and the expression app
 * (apps/expression, the trial scenarios); `appOf` says which one serves a route.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const REPO = resolve(import.meta.dirname, '../../../../..')
export const PLAYGROUND = join(REPO, 'apps/playground')
export const EXPRESSION = join(REPO, 'apps/expression')

export type MatrixApp = 'playground' | 'expression'
export const APP_DIRS: Readonly<Record<MatrixApp, string>> = {
  playground: PLAYGROUND,
  expression: EXPRESSION,
}

const ROUTES_DIR = join(PLAYGROUND, 'src/routes')

/** The expression app's one non-scenario page: its index. The scenario pages are hover-guard pages (`scenarioPaths`). */
export const EXPRESSION_INDEX = '/scenarios'

/** The `id`s of an app's `scenarios/scenario-info.ts`, in order. */
function scenarioIds(app: MatrixApp): string[] {
  const source = readFileSync(join(APP_DIRS[app], 'src/scenarios/scenario-info.ts'), 'utf8')
  const ids = [...source.matchAll(/\bid:\s*'([\w-]+)'/g)].map((m) => m[1] as string)
  if (ids.length === 0)
    throw new Error(`matrix: no scenario id in apps/${app}/src/scenarios/scenario-info.ts`)
  return ids
}

/** The first registered playground scenario id: the dynamic route (`scenarios.$name`) needs a concrete name. */
function firstScenario(): string {
  return scenarioIds('playground')[0] as string
}

/** Every registered scenario of both apps as a route: `/scenarios/<id>`, one per `id` in an app's `scenarios/scenario-info.ts`. */
export function scenarioPaths(): string[] {
  return [...scenarioIds('playground'), ...scenarioIds('expression')].map(
    (id) => `/scenarios/${id}`,
  )
}

/** The expression app's routes: its index and every scenario. The playground serves every other route. */
export function expressionPaths(): string[] {
  return [EXPRESSION_INDEX, ...scenarioIds('expression').map((id) => `/scenarios/${id}`)]
}

/** The app that serves `route`. */
export function appOf(route: string): MatrixApp {
  return expressionPaths().includes(route) ? 'expression' : 'playground'
}

/**
 * `BASALT_MATRIX_ROUTES=/scenarios/expr-n87,/table` keeps only those routes' cells (`make quality-matrix-fast`, through
 * scripts/matrix-select.ts, when a branch touched only scenarios), whichever app serves them. Unset or empty: every route (null). A path that is no
 * route or scenario throws: a typo must not run an empty matrix and pass.
 */
export function parseRoutes(value: string | undefined): ReadonlySet<string> | null {
  if (value === undefined || value.trim() === '') return null
  const known = new Set([...routePaths(), EXPRESSION_INDEX, ...scenarioPaths()])
  const wanted = value.split(',').map((route) => route.trim())
  const unknown = wanted.filter((route) => !known.has(route))
  if (unknown.length > 0)
    throw new Error(`matrix: BASALT_MATRIX_ROUTES names no route: ${unknown.join(', ')}`)
  return new Set(wanted)
}

/** Route files under `dir`, relative to it, skipping the `__`/`-` prefixed entries TanStack's generator ignores. */
function routeFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('__') || entry.name.startsWith('-')) return []
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) return routeFiles(dir, rel)
    return entry.name.endsWith('.tsx') ? [rel.slice(0, -'.tsx'.length)] : []
  })
}

/**
 * `index` -> `/`, `table` -> `/table`, `cycle/state` -> `/cycle/state`,
 * `scenarios.$name` -> `/scenarios/<first scenario>`, `peek.$id` -> `/peek/12`. A `<dir>/index` is the directory's own path.
 */
export function routePaths(): string[] {
  const names = routeFiles(ROUTES_DIR).toSorted()
  return names.map((name) => {
    const segments = name
      .split(/[./]/)
      .map((part) => (part === '$name' ? firstScenario() : part === '$id' ? '12' : part))
      .filter((part, i, all) => !(part === 'index' && i === all.length - 1))
    return `/${segments.join('/')}`
  })
}
