/**
 * The token codemod: rewrites a consumer's 2.x token names in any text file (CSS, TSX, MDX, HTML) to the v3 ones.
 *
 * Driven by the `codemod: "tokens"` rows of `packages/basalt-ui/migrations/areas`, in two passes:
 *
 * 1. Name rows map one 2.x name to its v3 name: `--vx-accent` -> `--basalt-brand`, `VX.surface.panel` ->
 *    `BASALT.card`. A member row matches under either accessor, so it holds whether `imports` ran first or not.
 * 2. Prefix rows (`from` and `to` end in `*`) rename what is left: `--vx-ink` -> `--basalt-ink`, the class
 *    `vx-prose` -> `basalt-prose`.
 *
 * The accessor binding itself (`import { VX }` -> `import { BASALT }`, scope-aware) is the `imports` codemod's
 * row `tok-js-accessor`; run `imports` and then `tokens`.
 */

export type NameRow = { id: string; from: string; to: string }
export type PrefixRow = { id: string; from: string; to: string }
export type TokenRows = { names: NameRow[]; prefixes: PrefixRow[] }

export type TokenChange = { file: string; row: string; from: string; to: string; count: number }
export type TokensResult = { text: string; changes: TokenChange[] }

const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A custom property, a class, or an accessor member path: the shapes a text rewrite can place. */
export const NAME_SHAPE = /^(--[A-Za-z0-9-]+|\.[A-Za-z][\w-]*|[A-Z][A-Z0-9_]*(\.[A-Za-z0-9_]+)+)$/

/** The accessors a member row may be spelled under: the 2.x one and the one its `to` names. */
function memberPattern(from: string, to: string): string {
  const [head, ...rest] = from.split('.')
  const toHead = to.split('.')[0] ?? head
  const heads = [...new Set([head, toHead])].map((h) => esc(h as string)).join('|')
  return `(?<![\\w$.])(?:${heads})\\.${rest.map(esc).join('\\.')}(?![\\w$])`
}

function namePattern(row: NameRow): RegExp {
  if (row.from.startsWith('--')) return new RegExp(`(?<![\\w-])${esc(row.from)}(?![\\w-])`, 'g')
  if (row.from.startsWith('.')) {
    return new RegExp(`(?<![\\w-])${esc(row.from.slice(1))}(?![\\w-])`, 'g')
  }
  return new RegExp(memberPattern(row.from, row.to), 'g')
}

function replacement(row: NameRow): string {
  return row.from.startsWith('.') ? row.to.slice(1) : row.to
}

/** A prefix row's pattern: `--vx-*` matches a custom property, `.vx-*` a class word (in CSS or markup). */
function prefixPattern(row: PrefixRow): { re: RegExp; to: string } {
  const from = row.from.slice(0, -1)
  const to = row.to.slice(0, -1)
  if (from.startsWith('.')) {
    return {
      re: new RegExp(`(?<![\\w\\-/@$])${esc(from.slice(1))}(?=[A-Za-z])`, 'g'),
      to: to.slice(1),
    }
  }
  return { re: new RegExp(`(?<![\\w-])${esc(from)}(?=[\\w$])`, 'g'), to }
}

export function transformTokens(
  source: string,
  opts: { file: string; rows: TokenRows },
): TokensResult {
  const changes: TokenChange[] = []
  let text = source
  const apply = (row: { id: string; from: string; to: string }, re: RegExp, to: string) => {
    let count = 0
    text = text.replace(re, () => {
      count++
      return to
    })
    if (count > 0) changes.push({ file: opts.file, row: row.id, from: row.from, to: row.to, count })
  }
  for (const row of opts.rows.names) apply(row, namePattern(row), replacement(row))
  for (const row of opts.rows.prefixes) {
    const { re, to } = prefixPattern(row)
    apply(row, re, to)
  }
  return { text, changes }
}
