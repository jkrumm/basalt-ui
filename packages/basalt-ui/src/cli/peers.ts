/**
 * The peers a profile needs beyond the lint tools: what `init` installs and what `doctor` check 3
 * names, one table so the two cannot drift. Runtime peers go in `dependencies`, build peers in
 * `devDependencies`. `react` and `react-dom` are the app's own and `init` never installs them.
 */
import type { Profile } from './manifest'

const FRAME = ['tailwindcss', '@base-ui/react'] as const
const APP_RUNTIME = ['@tanstack/react-query', '@tanstack/react-router'] as const
// What `basalt-ui/shell` imports statically: hotkeys, and drag and drop for the rail's favourites.
const SHELL = ['@tanstack/react-hotkeys', '@atlaskit/pragmatic-drag-and-drop'] as const

export const RUNTIME_PEERS: Readonly<Record<Profile, readonly string[]>> = {
  tokens: [],
  site: ['astro', '@astrojs/react'],
  bridge: FRAME,
  parts: FRAME,
  app: [...FRAME, ...APP_RUNTIME, ...SHELL],
}

export const BUILD_PEERS: Readonly<Record<Profile, readonly string[]>> = {
  tokens: [],
  site: ['tailwindcss', '@tailwindcss/vite'],
  bridge: ['@tailwindcss/vite'],
  parts: ['@tailwindcss/vite'],
  app: ['@tailwindcss/vite', '@tanstack/router-plugin'],
}

type Triple = [number, number, number]

/** `1`, `1.2`, `1.2.3` (a leading `v` or operator already stripped) as a triple plus how many parts were written. */
function parseBase(text: string): { base: Triple; parts: number } | null {
  const match = /^v?(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?/.exec(text)
  if (match === null) return null
  const given = [match[1], match[2], match[3]].filter((p) => p !== undefined && !/^[xX*]$/.test(p))
  const [major = 0, minor = 0, patch = 0] = given.map(Number)
  return { base: [major, minor, patch], parts: given.length }
}

const cmp = (a: Triple, b: Triple): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** One comparator (`^1.2.3`, `~1.9.0`, `>=3.14.0`, `<4`, `7`, `1.2.3`) against a version. */
function meetsComparator(version: Triple, comparator: string): boolean {
  const op = /^(\^|~|>=|<=|>|<|=)?/.exec(comparator)?.[1] ?? ''
  const parsed = parseBase(comparator.slice(op.length))
  if (parsed === null) return false
  const { base, parts } = parsed
  const [major, minor, patch] = base
  const upper = (): Triple => {
    if (op === '~') return parts >= 2 ? [major, minor + 1, 0] : [major + 1, 0, 0]
    if (op === '^') {
      if (major > 0 || parts < 2) return [major + 1, 0, 0]
      return minor > 0 || parts < 3 ? [0, minor + 1, 0] : [0, 0, patch + 1]
    }
    // A bare partial (`7`, `1.2`) is an x-range; a full triple is an exact match.
    return parts === 1
      ? [major + 1, 0, 0]
      : parts === 2
        ? [major, minor + 1, 0]
        : [major, minor, patch + 1]
  }
  switch (op) {
    case '>=':
      return cmp(version, base) >= 0
    case '>':
      return cmp(version, base) > 0
    case '<=':
      return cmp(version, base) <= 0
    case '<':
      return cmp(version, base) < 0
    default:
      return cmp(version, base) >= 0 && cmp(version, upper()) < 0
  }
}

/**
 * Whether `installed` (`1.2.3`, a prerelease tail ignored) falls in `range`: the shapes the peer
 * table uses (exact, `^`, `~`, `>=a <b`, partial, `a || b`). A range it cannot read is not met.
 */
export function satisfiesRange(installed: string, range: string): boolean {
  const version = parseBase(installed)
  if (version === null || version.parts < 3) return false
  return range.split('||').some((alternative) => {
    const comparators = alternative.trim().split(/\s+/).filter(Boolean)
    return comparators.length > 0 && comparators.every((c) => meetsComparator(version.base, c))
  })
}

/** `name@spec`, shell-quoted when the spec holds a space, `|`, `<` or `>`. */
export function peerSpec(name: string, range: string | undefined): string {
  if (range === undefined) return name
  const spec = `${name}@${range}`
  return /[\s|<>]/.test(spec) ? `'${spec}'` : spec
}
