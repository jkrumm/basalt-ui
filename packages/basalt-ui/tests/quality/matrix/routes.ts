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

/** `index` -> `/`, `table` -> `/table`, `scenarios.$name` -> `/scenarios/<first scenario>`. */
export function routePaths(): string[] {
  const files = readdirSync(ROUTES_DIR)
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('__'))
    .map((file) => file.slice(0, -'.tsx'.length))
    .toSorted()
  return files.map((name) => {
    if (name === 'index') return '/'
    return `/${name
      .split('.')
      .map((part) => (part === '$name' ? firstScenario() : part))
      .join('/')}`
  })
}
