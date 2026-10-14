/**
 * The three gates `docs/V2-SPEC.md` § 1 "Rules" promises, as pure functions over data so the tests
 * run on fixtures while `check-budgets.ts` feeds them the real snapshot, manifest and dist:
 *
 * 1. one import path per symbol — no name under two subpaths;
 * 2. every public value symbol has a named consumer in `scripts/consumers.json`;
 * 3. peer classes — required / subpath-required / optional — hold in the built dist graph and `.d.ts`.
 *
 * Every function returns violation strings; empty means green.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** A `Record<subpath, exported names>` — the shape of `scripts/export-surface.json`. */
export type Surface = Readonly<Record<string, readonly string[]>>

/** The chart layer's subpath (§ 9): its symbols are budgeted apart from the non-chart ones. */
export const CHART_SUBPATH = './charts'

/** Names exported from more than one subpath, as `name (./a, ./b)`. */
export function duplicateSymbols(surface: Surface): string[] {
  const homes = new Map<string, string[]>()
  for (const [subpath, names] of Object.entries(surface)) {
    for (const name of names) homes.set(name, [...(homes.get(name) ?? []), subpath])
  }
  return [...homes]
    .filter(([, paths]) => paths.length > 1)
    .map(([name, paths]) => `${name} (${paths.join(', ')})`)
}

/**
 * Public VALUE symbols with no `consumers.json` entry, plus entries naming none. The
 * snapshot (`export-surface.json`) lists runtime exports only, so `consumers.json` is value-only
 * too: a type name in it is stale. Types are gated by the "barrel type exports" budget instead.
 */
export function consumerViolations(
  surface: Surface,
  consumers: Readonly<Record<string, string>>,
): string[] {
  const publicNames = new Set(Object.values(surface).flat())
  const missing = [...publicNames]
    .filter((name) => !consumers[name])
    .map((name) => `${name}: public symbol has no named consumer in scripts/consumers.json`)
  const stale = Object.keys(consumers)
    .filter((name) => !publicNames.has(name))
    .map((name) => `${name}: in scripts/consumers.json but not a public value symbol`)
  return [...missing, ...stale]
}

// ── Peer classes ────────────────────────────────────────────────────────────────────────────────

/** § 1 "Peers": installed by every consumer; `.` or `./styles.css` imports or names it. */
export const REQUIRED_PEERS: readonly string[] = [
  'react',
  'react-dom',
  '@mantine/core',
  '@mantine/hooks',
  '@mantine/modals',
  '@mantine/notifications',
  '@mantine/spotlight',
  '@tanstack/react-router',
  '@tanstack/react-query',
  '@fontsource-variable/hubot-sans',
  '@fontsource-variable/jetbrains-mono',
  '@fontsource-variable/nunito-sans',
]

/**
 * § 1 "Peers": per subpath, the optional-in-`package.json` peers its consumers must install because
 * the subpath imports them statically or names them in its public `.d.ts`.
 */
export const SUBPATH_REQUIRED_PEERS: Readonly<Record<string, readonly string[]>> = {
  './commands': ['@tanstack/react-hotkeys'],
  './agent': ['ai', '@ai-sdk/provider', 'motion'],
  './table': ['@tanstack/react-table'],
  './forms': ['@mantine/form'],
  './controls-dates': ['@mantine/dates', 'dayjs'],
  './content': ['react-markdown'],
  './vite': ['vite'],
  [CHART_SUBPATH]: ['@tanstack/charts', 'd3-scale'],
}

/**
 * Spec-vs-landed gaps, each owned by a later wave; an entry is deleted in the commit that closes it.
 * `unreached`: classified subpath-required (V2-SPEC § 1) but the graph does not reach the peer yet
 * (only `import()` reaches it, or the public type that would name it is not typed that way yet).
 * `tolerated`: reached from a subpath that § 1 does not allow it on.
 */
export const DEFERRED_PEER_GAPS: {
  readonly unreached: Readonly<Record<string, readonly string[]>>
  readonly tolerated: Readonly<Record<string, readonly string[]>>
} = {
  unreached: {
    './agent': ['ai', '@ai-sdk/provider'], // `aiSdkTransport` reaches `ai` only via import()
    './controls-dates': ['dayjs'], // named by `@mantine/dates`, not imported by basalt
  },
  tolerated: {
    '.': ['motion'], // `ThemeToggle` drops motion with § 5 (W7)
  },
}

/** The bare package a specifier names: `@scope/pkg/deep` → `@scope/pkg`, `pkg/deep` → `pkg`. */
export function packageOf(specifier: string): string {
  const [first = '', second] = specifier.split('/')
  return first.startsWith('@') && second ? `${first}/${second}` : first
}

type Reach = { readonly staticPeers: Set<string>; readonly typePeers: Set<string> }

/** Static `from '…'` / `import '…'` specifiers; `import('…')` only when `dynamic` is set. */
function specifiers(source: string, dynamic: boolean): string[] {
  const out: string[] = []
  const staticRe = /(?:\bfrom|^\s*import)\s*['"]([^'"]+)['"]/gm
  for (const m of source.matchAll(staticRe)) out.push(m[1] ?? '')
  if (dynamic) {
    for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1] ?? '')
  }
  return out
}

function resolveRelative(from: string, spec: string, exts: readonly string[]): string | undefined {
  const base = resolve(dirname(from), spec)
  // Only candidates carrying a wanted extension: a `./a.js` specifier in the `.d.ts` walk must land
  // on `a.d.ts`, never on the sibling `a.js` (that would walk JS and invent type-reached peers).
  const candidates = exts.flatMap((e) => [base.replace(/\.js$/, '') + e, join(base, `index${e}`)])
  return candidates.find((c) => existsSync(c))
}

/**
 * Bare packages reached from `entryJs` (static imports through relative modules; lazy `import()` is
 * deliberately NOT followed — that is what makes a peer optional) and named by the `.d.ts` graph
 * rooted at `entryDts` (static and `import('…')` type references both count: a public type names it).
 */
export function reachFromEntry(entryJs: string, entryDts: string): Reach {
  const walk = (entry: string, dynamic: boolean, exts: readonly string[], into: Set<string>) => {
    const seen = new Set<string>()
    const stack = existsSync(entry) ? [entry] : []
    while (stack.length > 0) {
      const file = stack.pop() as string
      if (seen.has(file)) continue
      seen.add(file)
      for (const spec of specifiers(readFileSync(file, 'utf8'), dynamic)) {
        if (spec.startsWith('.')) {
          const next = resolveRelative(file, spec, exts)
          if (next) stack.push(next)
        } else if (!spec.startsWith('node:')) {
          into.add(packageOf(spec))
        }
      }
    }
  }
  const reach: Reach = { staticPeers: new Set(), typePeers: new Set() }
  walk(entryJs, false, ['.js'], reach.staticPeers)
  walk(entryDts, true, ['.d.ts'], reach.typePeers)
  return reach
}

export type Manifest = {
  readonly exports?: Readonly<
    Record<string, string | null | { readonly import?: string; readonly types?: string }>
  >
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>
}

/**
 * Asserts all three classes against a package root (its `package.json` and built `dist/`):
 * required peers are not marked optional; every other declared peer is optional; a peer reached
 * statically or named in a public `.d.ts` is required, subpath-required for exactly that subpath,
 * or a violation; and each subpath-required peer really is reached (a stale classification fails).
 */
export function peerClassViolations(root: string, manifest: Manifest): string[] {
  const peers = Object.keys(manifest.peerDependencies ?? {})
  const optional = (name: string) => manifest.peerDependenciesMeta?.[name]?.optional === true
  const violations: string[] = []

  for (const name of REQUIRED_PEERS) {
    if (!peers.includes(name)) violations.push(`${name}: required peer is not declared`)
    else if (optional(name)) violations.push(`${name}: required peer is marked optional`)
  }
  for (const name of peers) {
    if (!REQUIRED_PEERS.includes(name) && !optional(name)) {
      violations.push(`${name}: non-required peer must be optional in peerDependenciesMeta`)
    }
  }
  for (const name of Object.values(SUBPATH_REQUIRED_PEERS).flat()) {
    if (!peers.includes(name)) violations.push(`${name}: subpath-required peer is not declared`)
  }

  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    if (typeof target !== 'object' || target === null) continue
    const { import: js, types } = target
    if (!js || !types) continue
    const { staticPeers, typePeers } = reachFromEntry(resolve(root, js), resolve(root, types))
    const allowed = SUBPATH_REQUIRED_PEERS[subpath] ?? []
    const reached = new Set([...staticPeers, ...typePeers])
    for (const name of reached) {
      if (!peers.includes(name) || REQUIRED_PEERS.includes(name)) continue
      if (allowed.includes(name)) continue
      if (DEFERRED_PEER_GAPS.tolerated[subpath]?.includes(name)) continue
      const how = staticPeers.has(name) ? 'imports' : 'names in its .d.ts'
      violations.push(
        `${subpath} ${how} the optional peer ${name} without it being subpath-required for ${subpath}`,
      )
    }
    for (const name of allowed) {
      if (!reached.has(name) && !DEFERRED_PEER_GAPS.unreached[subpath]?.includes(name)) {
        violations.push(
          `${subpath}: ${name} is classified subpath-required but the graph never reaches it`,
        )
      }
    }
  }
  return violations
}
