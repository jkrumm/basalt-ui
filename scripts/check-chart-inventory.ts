/**
 * Recounts `docs/waves/v2-chart-inventory.md` against its own stated totals: per-repo row counts,
 * the per-kind totals table and the headline prose. Exits 1 listing every disagreement.
 */
import { readFileSync } from 'node:fs'

const FILE = 'docs/waves/v2-chart-inventory.md'
const text = readFileSync(FILE, 'utf8')
const errors: string[] = []

const REPOS = { argo: 'a', linewatch: 'l', weatherorb: 'w' } as const
type Repo = keyof typeof REPOS

const cells = (line: string): string[] =>
  line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((c) => c.trim())

const section = (heading: RegExp): string => {
  const start = text.search(heading)
  if (start < 0) throw new Error(`missing section ${heading}`)
  const rest = text.slice(start + 1)
  const end = rest.search(/\n##/)
  return end < 0 ? rest : rest.slice(0, end)
}

const kindOf = (cell: string): string =>
  cell
    .replace(/`/g, '')
    .replace(/\s*\(.*\)$/, '')
    .trim()

interface Row {
  repo: Repo
  kind: string
  dev: boolean
}

const rows: Row[] = (Object.keys(REPOS) as Repo[]).flatMap((repo) =>
  section(new RegExp(`^### ${repo}`, 'm'))
    .split('\n')
    .filter((l) => new RegExp(`^\\| ${REPOS[repo]}\\d+ `).test(l))
    .map(cells)
    .map((c) => ({ repo, kind: kindOf(c[3]), dev: c[1].includes('(dev)') })),
)

const count = (match: (r: Row) => boolean): number => rows.filter(match).length
const production = count((r) => !r.dev)
const devTotal = count((r) => r.dev)

const expectEq = (what: string, stated: number, counted: number): void => {
  if (stated !== counted) errors.push(`${what}: stated ${stated}, counted ${counted}`)
}

// "**59 production charts** in 3 repos — argo 40, linewatch 11, weatherorb 8 — plus 3 on argo's dev-only"
const head = text
  .replace(/\s+/g, ' ')
  .match(
    /\*\*(\d+) production charts\*\* in 3 repos — argo (\d+), linewatch (\d+), weatherorb (\d+) — plus (\d+) on argo's dev-only/,
  )
if (head) {
  expectEq('production total (prose)', Number(head[1]), production)
  expectEq(
    'argo (prose)',
    Number(head[2]),
    count((r) => r.repo === 'argo' && !r.dev),
  )
  expectEq(
    'linewatch (prose)',
    Number(head[3]),
    count((r) => r.repo === 'linewatch' && !r.dev),
  )
  expectEq(
    'weatherorb (prose)',
    Number(head[4]),
    count((r) => r.repo === 'weatherorb' && !r.dev),
  )
  expectEq('dev total (prose)', Number(head[5]), devTotal)
} else {
  errors.push('headline prose not found')
}

// Totals table: first cell names the kind(s) "A / B", second the counts "2 / 1" (+ "(+N dev)").
const totals = section(/^### Totals/m)
  .split('\n')
  .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
  .map(cells)
  .slice(1)

const named = new Set<string>()
for (const [name, counts, from] of totals) {
  const isTotal = name === '**Total**'
  const kinds = name.split(' / ').map(kindOf)
  const stated = counts.replace(/\*/g, '').split(' / ')
  kinds.forEach((kind, i) => {
    const m = stated[i]?.match(/^(\d+)(?: \(\+(\d+) dev\))?/)
    if (!m) return void errors.push(`unparseable count for ${kind}: ${stated[i]}`)
    if (isTotal) {
      expectEq('Total production', Number(m[1]), production)
      return expectEq('Total dev', Number(m[2] ?? 0), devTotal)
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
    const byRepo = from.match(/^argo (\d+), linewatch (\d+), weatherorb (\d+)$/)
    if (byRepo && kinds.length === 1)
      (Object.keys(REPOS) as Repo[]).forEach((repo, j) =>
        expectEq(
          `${kind} from ${repo}`,
          Number(byRepo[j + 1]),
          count((r) => r.repo === repo && r.kind === kind && !r.dev),
        ),
      )
  })
}

for (const kind of new Set(rows.map((r) => r.kind)))
  if (!named.has(kind)) errors.push(`kind ${kind} has rows but is missing from § Totals`)

if (errors.length > 0) {
  console.error(`${FILE}: ${errors.length} disagreement(s)\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(
  `${FILE}: ${production} production + ${devTotal} dev, per-repo and per-kind totals agree`,
)
