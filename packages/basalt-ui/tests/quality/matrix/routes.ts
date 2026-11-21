/**
 * The matrix route list, read from the playground's routes directory at run time: a route added
 * there joins the matrix with no edit here (quality-contract section 4).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const REPO = resolve(import.meta.dirname, '../../../../..')
export const PLAYGROUND = join(REPO, 'apps/playground')
const ROUTES_DIR = join(PLAYGROUND, 'src/routes')

/** The first registered scenario id: the dynamic route (`scenarios.$name`) needs a concrete name. */
function firstScenario(): string {
  const source = readFileSync(join(PLAYGROUND, 'src/scenarios/scenario-info.ts'), 'utf8')
  const id = /\bid:\s*'([\w-]+)'/.exec(source)?.[1]
  if (id === undefined) throw new Error('matrix: no scenario id in scenarios/scenario-info.ts')
  return id
}

/** Every registered scenario as a route: `/scenarios/<id>`, one per `id` in `scenarios/scenario-info.ts`. */
export function scenarioPaths(): string[] {
  const source = readFileSync(join(PLAYGROUND, 'src/scenarios/scenario-info.ts'), 'utf8')
  return [...source.matchAll(/\bid:\s*'([\w-]+)'/g)].map((m) => `/scenarios/${m[1]}`)
}

/**
 * `BASALT_MATRIX_ROUTES=/scenarios/expr-n87,/table` keeps only those routes' cells (`make quality-matrix-fast`, through
 * scripts/matrix-select.ts, when a branch touched only scenarios). Unset or empty: every route (null). A path that is no
 * route or scenario throws: a typo must not run an empty matrix and pass.
 */
export function parseRoutes(value: string | undefined): ReadonlySet<string> | null {
  if (value === undefined || value.trim() === '') return null
  const known = new Set([...routePaths(), ...scenarioPaths()])
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
