/**
 * Recounts `docs/waves/v2-chart-inventory.md` against its own stated totals: per-repo row counts,
 * the per-kind totals table and the headline prose. Exits 1 listing every disagreement.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const INVENTORY_FILE = join(import.meta.dir, '../docs/waves/v2-chart-inventory.md')

const REPO_PREFIX = { argo: 'a', linewatch: 'l', weatherorb: 'w' } as const
type Repo = keyof typeof REPO_PREFIX
const REPOS = Object.keys(REPO_PREFIX) as Repo[]

/** A structurally malformed doc (missing section, short row): reported, never a TypeError. */
class InventoryError extends Error {}

interface Row {
  repo: Repo
  kind: string
  dev: boolean
}

export interface InventoryResult {
  errors: string[]
  production: number
  dev: number
}

const cells = (line: string): string[] =>
  line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((c) => c.trim())

const mustGet = (row: readonly string[], index: number, what: string): string => {
  const value = row[index]
  if (value === undefined || value === '')
    throw new InventoryError(`${what}: empty or missing cell ${index + 1}`)
  return value
}

const section = (text: string, heading: RegExp): string => {
  const start = text.search(heading)
  if (start < 0) throw new InventoryError(`missing section ${heading}`)
  const rest = text.slice(start + 1)
  const end = rest.search(/\n##/)
  return end < 0 ? rest : rest.slice(0, end)
}

const kindOf = (cell: string): string =>
  cell
    .replace(/`/g, '')
    .replace(/\s*\(.*\)$/, '')
    .trim()

function parseRows(text: string): Row[] {
  return REPOS.flatMap((repo) => {
    const lines = section(text, new RegExp(`^### ${repo}`, 'm'))
      .split('\n')
      .filter((l) => new RegExp(`^\\| ${REPO_PREFIX[repo]}\\d+ `).test(l))
    if (lines.length === 0) throw new InventoryError(`section ${repo} has no chart rows`)
    return lines.map((line) => {
      const c = cells(line)
      const id = mustGet(c, 0, `${repo} row`)
      return {
        repo,
        kind: kindOf(mustGet(c, 3, `${repo} row ${id}, 2.0 column`)),
        dev: mustGet(c, 1, `${repo} row ${id}, file column`).includes('(dev)'),
      }
    })
  })
}

export function checkInventory(text: string): InventoryResult {
  const errors: string[] = []
  const expectEq = (what: string, stated: number, counted: number): void => {
    if (stated !== counted) errors.push(`${what}: stated ${stated}, counted ${counted}`)
  }
  let rows: Row[]
  try {
    rows = parseRows(text)
  } catch (e) {
    if (!(e instanceof InventoryError)) throw e
    return { errors: [e.message], production: 0, dev: 0 }
  }
  const count = (match: (r: Row) => boolean): number => rows.filter(match).length
  const production = count((r) => !r.dev)
  const dev = count((r) => r.dev)

  // "**59 production charts** in 3 repos — argo 40, linewatch 11, weatherorb 8 — plus 3 on argo's dev-only"
  const head = text
    .replace(/\s+/g, ' ')
    .match(
      /\*\*(\d+) production charts\*\* in 3 repos — argo (\d+), linewatch (\d+), weatherorb (\d+) — plus (\d+) on argo's dev-only/,
    )
  if (head) {
    expectEq('production total (prose)', Number(head[1]), production)
    REPOS.forEach((repo, i) =>
      expectEq(
        `${repo} (prose)`,
        Number(head[i + 2]),
        count((r) => r.repo === repo && !r.dev),
      ),
    )
    expectEq('dev total (prose)', Number(head[5]), dev)
  } else {
    errors.push('headline prose not found')
  }

  const named = new Set<string>()
  try {
    const totals = section(text, /^### Totals/m)
      .split('\n')
      .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
      .map(cells)
      .slice(1)
    if (totals.length === 0) throw new InventoryError('Totals table has no rows')
    for (const row of totals) checkTotalsRow(row, rows, { production, dev }, named, expectEq)
  } catch (e) {
    if (!(e instanceof InventoryError)) throw e
    errors.push(e.message)
  }

  for (const kind of new Set(rows.map((r) => r.kind)))
    if (!named.has(kind)) errors.push(`kind ${kind} has rows but is missing from § Totals`)

  return { errors, production, dev }
}

/** One Totals row: "A / B" kinds, "2 / 1" counts (each optionally "(+N dev)"), a per-repo split. */
function checkTotalsRow(
  row: readonly string[],
  rows: readonly Row[],
  total: { production: number; dev: number },
  named: Set<string>,
  expectEq: (what: string, stated: number, counted: number) => void,
): void {
  const name = mustGet(row, 0, 'Totals row')
  const stated = mustGet(row, 1, `Totals row ${name}`).replace(/\*/g, '').split(' / ')
  const count = (match: (r: Row) => boolean): number => rows.filter(match).length
  const kinds = name.split(' / ').map(kindOf)
  const isTotal = name === '**Total**'

  kinds.forEach((kind, i) => {
    const m = stated[i]?.match(/^(\d+)(?: \(\+(\d+) dev\))?/)
    if (!m) throw new InventoryError(`Totals row ${kind}: unparseable count "${stated[i] ?? ''}"`)
    if (isTotal) {
      expectEq('Total production', Number(m[1]), total.production)
      return expectEq('Total dev', Number(m[2] ?? 0), total.dev)
    }
    named.add(kind)
    expectEq(
      `${kind} production`,
      Number(m[1]),
      count((r) => r.kind === kind && !r.dev),
    )
    expectEq(
      `${kind} dev`,
      Number(m[2] ?? 0),
      count((r) => r.kind === kind && r.dev),
    )
  })

  if (isTotal || kinds.length !== 1) return
  const [kind] = kinds
  const from = mustGet(row, 2, `Totals row ${kind}`)
  const items = from.split(', ').map((item) => item.match(/^(.+?) (\d+)(?: \(.*\))?$/))
  if (items.some((m) => m === null))
    throw new InventoryError(`Totals row ${kind}: unparseable breakdown "${from}"`)
  const parts = items.flatMap((m) => (m ? [{ label: m[1] ?? '', n: Number(m[2]) }] : []))
  const production = count((r) => r.kind === kind && !r.dev)
  const isRepoSplit = parts.length === REPOS.length && parts.every((p, i) => p.label === REPOS[i])
  if (!isRepoSplit)
    return expectEq(
      `${kind} breakdown`,
      parts.reduce((sum, p) => sum + p.n, 0),
      production,
    )
  parts.forEach((p, i) => {
    const repo = REPOS[i] as Repo
    expectEq(
      `${kind} from ${repo}`,
      p.n,
      count((r) => r.repo === repo && r.kind === kind && !r.dev),
    )
  })
}

if (import.meta.main) {
  const { errors, production, dev } = checkInventory(readFileSync(INVENTORY_FILE, 'utf8'))
  if (errors.length > 0) {
    console.error(`${INVENTORY_FILE}: ${errors.length} disagreement(s)\n- ${errors.join('\n- ')}`)
    process.exit(1)
  }
  console.log(`v2-chart-inventory.md: ${production} production + ${dev} dev, totals agree`)
}
