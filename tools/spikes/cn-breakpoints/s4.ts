/**
 * S4: the `tw-off-law` zone A colour denial (tokens-visual 3.5), probed over consumer code.
 *
 * A standalone matcher, generated from the same table the real rule is (`zoneADenial()`): a class
 * is flagged when its prefix is in the denied list and its colour is an earned token, or when it
 * is denied outright. TS colour (`c={VX.`, `color={VX.`) is counted as flagged sites too.
 */
import ts from 'typescript'
import { zoneADenial } from '../../../packages/basalt-ui/src/tokens/emit'
import { extractTokens } from './classes'
import { parse, siteRef } from './scan'
import type { RepoName, ScannedRepo, SiteRef } from './scan'

const denial = zoneADenial()
const bySize = (a: string, b: string): number => b.length - a.length
const NAMES = denial.names.toSorted(bySize).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const PREFIXES = denial.prefixes.toSorted(bySize)

// `border-l-bad`, `ring-offset-brand`, `divide-x-good`: an optional side or offset word between.
const EARNED_RE = new RegExp(
  `^(?:${PREFIXES.join('|')})(?:-(?:x|y|t|r|b|l|s|e|offset|inset))?-(?:${NAMES.join('|')})$`,
)
const OUTRIGHT = new Set(denial.deniedOutright.filter((o) => !o.endsWith('-')))
const OUTRIGHT_PREFIXES = denial.deniedOutright.filter((o) => o.endsWith('-'))
const ALLOWED = new Set(denial.allowedCurrent)

/** Variants, `!`, a leading `-` and the `/NN` modifier stripped. */
export function coreOf(token: string): string {
  let depth = 0
  let colon = -1
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === ':' && depth === 0) colon = i
  }
  let u = token
    .slice(colon + 1)
    .replace(/^!/, '')
    .replace(/!$/, '')
    .replace(/^-/, '')
  let slash = -1
  depth = 0
  for (let i = 0; i < u.length; i++) {
    const c = u[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === '/' && depth === 0) slash = i
  }
  if (slash > 0) u = u.slice(0, slash)
  return u
}

export function zoneAFlag(token: string): boolean {
  const core = coreOf(token)
  if (ALLOWED.has(core)) return false
  if (OUTRIGHT.has(core)) return true
  if (OUTRIGHT_PREFIXES.some((p) => core.startsWith(p))) return true
  return EARNED_RE.test(core)
}

export const ZONE_A_SIZE = { names: denial.names.length, prefixes: denial.prefixes.length }

/** `c={VX.good}` / `color={VX.bad}` — and any `c`/`color` attribute whose expression reads `VX.`. */
const LITERAL_RE = /\b(?:c|color)=\{VX\./g

/** The `VX.…` paths read inside an expression (`VX.status.warn`, `VX.muted`). */
function vxPaths(e: ts.Node, sf: ts.SourceFile): string[] {
  const found: string[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isPropertyAccessExpression(n)) {
      let root: ts.Expression = n
      while (ts.isPropertyAccessExpression(root)) root = root.expression
      if (ts.isIdentifier(root) && root.text === 'VX') {
        found.push(n.getText(sf))
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(e)
  return found
}

/** A VX key that names an earned colour (status, brand, accent, series, line), not a neutral ink. */
const HUE_RE = /status|good|warn|bad|info|accent|brand|destructive|chart|seq|line/i

export interface S4Repo {
  scannedFiles: number
  scannedLines: number
  scannedTsxLines: number
  classSites: number
  classSitesStrict: number
  tsColourLiteral: number
  tsColour: number
  tsColourHue: number
  flagged: number
  refs: SiteRef[]
}

export interface S4Site {
  repo: RepoName
  file: string
  line: number
}

export function probe(repo: ScannedRepo): S4Repo {
  let classSites = 0
  let classSitesStrict = 0
  let tsColour = 0
  let tsHue = 0
  let tsLiteral = 0
  const sites: S4Site[] = []
  const files = repo.files.filter((f) => !f.ui)
  for (const file of files) {
    const sf = parse(file)
    for (const t of extractTokens(sf)) {
      if (t.partial || !zoneAFlag(t.text)) continue
      classSites++
      if (t.strict) classSitesStrict++
      sites.push({ repo: repo.def.name, file: file.rel, line: t.line })
    }
    tsLiteral += [...file.text.matchAll(LITERAL_RE)].length
    const visit = (n: ts.Node): void => {
      const isColourAttr =
        ts.isJsxAttribute(n) &&
        ts.isIdentifier(n.name) &&
        (n.name.text === 'c' || n.name.text === 'color') &&
        n.initializer !== undefined
      const paths = isColourAttr && n.initializer ? vxPaths(n.initializer, sf) : []
      if (paths.length > 0) {
        tsColour++
        if (paths.some((p) => HUE_RE.test(p))) tsHue++
        const at = sf.getLineAndCharacterOfPosition(n.getStart(sf))
        sites.push({ repo: repo.def.name, file: file.rel, line: at.line + 1 })
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  const lines = (fs: typeof files): number =>
    fs.reduce((n, f) => n + f.text.split('\n').length - (f.text.endsWith('\n') ? 1 : 0), 0)
  const refs = sites.flatMap((s) => {
    const r = siteRef(s.repo, repo.visibility, s.file, s.line)
    return r ? [r] : []
  })
  return {
    scannedFiles: files.length,
    scannedLines: lines(files),
    scannedTsxLines: lines(files.filter((f) => f.tsx)),
    classSites,
    classSitesStrict,
    tsColourLiteral: tsLiteral,
    tsColour,
    tsColourHue: tsHue,
    flagged: classSites + tsColour,
    refs,
  }
}
