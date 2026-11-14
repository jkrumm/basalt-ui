/**
 * The matrix route list, read from the playground's routes directory at run time: a route added
 * there joins the matrix with no edit here (quality-contract section 4).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const REPO = resolve(import.meta.dirname, '../../../../..')
export const PLAYGROUND = join(REPO, 'apps/playground')
const ROUTES_DIR = join(PLAYGROUND, 'src/routes')

/** The first registered scenario id: the one dynamic route (`scenarios.$name`) needs a concrete name. */
function firstScenario(): string {
  const source = readFileSync(join(PLAYGROUND, 'src/scenarios/scenario-info.ts'), 'utf8')
  const id = /\bid:\s*'([\w-]+)'/.exec(source)?.[1]
  if (id === undefined) throw new Error('matrix: no scenario id in scenarios/scenario-info.ts')
  return id
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
 * `scenarios.$name` -> `/scenarios/<first scenario>`. A `<dir>/index` is the directory's own path.
 */
export function routePaths(): string[] {
  const names = routeFiles(ROUTES_DIR).toSorted()
  return names.map((name) => {
    const segments = name
      .split(/[./]/)
      .map((part) => (part === '$name' ? firstScenario() : part))
      .filter((part, i, all) => !(part === 'index' && i === all.length - 1))
    return `/${segments.join('/')}`
  })
}
