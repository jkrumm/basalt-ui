/**
 * basalt-ui CLI — `init`, `sync`, `check-theme`.
 *
 * `checkTheme` is a REAL Bun-runtime port of argo `scripts/check-theme.mjs`: the theme guard that
 * fails on colors bypassing the central palette. `init`/`sync` are S5 placeholders.
 *
 * Bun runtime only (uses `Bun.Glob`). Config is read from the consuming package.json `"basalt"`
 * key; argo's hardcoded values are the DEFAULTS.
 */
import { Glob } from 'bun'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

/** Shape of the optional `"basalt"` key in a consumer's package.json. */
export type BasaltConfig = {
  /** Source roots to scan. Default: argo's `['apps/dashboard/src', 'packages/charts/src']`. */
  roots?: string[]
  /** Files exempt from the scan (they ARE the palette source). Default: argo's exempt set. */
  exempt?: string[]
  /** Named spacing-scale steps (px) flagged when used as a raw spacing prop. Default: 10/12/16/20/32. */
  spacingSteps?: number[]
  /** Off-identity Mantine accent families forbidden as chrome accents. Default: argo's set. */
  forbiddenAccents?: string[]
}

const DEFAULT_ROOTS = ['apps/dashboard/src', 'packages/charts/src']
const DEFAULT_EXEMPT = [
  'packages/charts/src/palette.ts',
  'packages/charts/src/theme-vars.ts',
  'packages/charts/src/tokens.ts',
  'packages/charts/src/utils/color.ts',
  'apps/dashboard/src/theme.ts',
]
const DEFAULT_SPACING_STEPS = [10, 12, 16, 20, 32]
const DEFAULT_FORBIDDEN_ACCENTS = ['teal', 'violet', 'grape', 'indigo', 'pink']

const SKIP = /\.gen\.ts$|\.test\.[tj]sx?$|\.d\.ts$/
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const FUNC = /\b(?:rgba?|hsla?)\(/g
// localStorage theme read — banned (theme must resolve via the Mantine color scheme + --vx-* vars).
const LOCALSTORAGE_THEME = /localStorage\s*\.\s*getItem\s*\(\s*['"]theme['"]\s*\)/g

type Violation = { rel: string; line: number; token: string; kind: string }

function readBasaltConfig(cwd: string): BasaltConfig {
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as {
      basalt?: BasaltConfig
    }
    return pkg.basalt ?? {}
  } catch {
    return {}
  }
}

function scanFile(
  abs: string,
  rel: string,
  patterns: {
    forbiddenAccent: RegExp
    spacingProp: RegExp
    radiusProp: RegExp
  },
  violations: Violation[],
): void {
  const lines = readFileSync(abs, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.includes('theme-allow')) continue
    for (const m of line.matchAll(HEX)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-hex' })
    }
    for (const m of line.matchAll(FUNC)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-color-fn' })
    }
    for (const m of line.matchAll(LOCALSTORAGE_THEME)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'localstorage-theme' })
    }
    for (const m of line.matchAll(patterns.forbiddenAccent)) {
      violations.push({ rel, line: i + 1, token: m[1] ?? '', kind: 'off-identity-accent' })
    }
    for (const m of line.matchAll(patterns.spacingProp)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-spacing' })
    }
    for (const m of line.matchAll(patterns.radiusProp)) {
      violations.push({ rel, line: i + 1, token: m[0], kind: 'raw-radius' })
    }
  }
}

/**
 * Theme guard — scans source roots for raw color literals (hex / rgb() / hsl()), off-identity
 * Mantine accent props, raw spacing/radius props that equal a named scale step, and localStorage
 * theme reads. Exits non-zero on violations. A `theme-allow` comment exempts a line.
 */
export function checkTheme(cwd: string = process.cwd()): void {
  const cfg = readBasaltConfig(cwd)
  const roots = cfg.roots ?? DEFAULT_ROOTS
  const exempt = new Set(cfg.exempt ?? DEFAULT_EXEMPT)
  const spacingSteps = cfg.spacingSteps ?? DEFAULT_SPACING_STEPS
  const forbiddenAccents = cfg.forbiddenAccents ?? DEFAULT_FORBIDDEN_ACCENTS

  const patterns = {
    forbiddenAccent: new RegExp(
      `\\b(?:color|c|bg|backgroundColor)\\s*=\\s*\\{?\\s*['"](${forbiddenAccents.join('|')})['"]`,
      'g',
    ),
    spacingProp: new RegExp(
      `\\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)=\\{(?:${spacingSteps.join('|')})\\}`,
      'g',
    ),
    radiusProp: /\bradius=(?:\{[0-9]+\}|"[0-9]+")/g,
  }

  const violations: Violation[] = []
  for (const root of roots) {
    const glob = new Glob('**/*.{ts,tsx}')
    for (const f of glob.scanSync({ cwd: resolve(cwd, root), absolute: true })) {
      const rel = relative(cwd, f)
      if (SKIP.test(rel) || exempt.has(rel)) continue
      scanFile(f, rel, patterns, violations)
    }
  }

  if (violations.length === 0) {
    console.log('✓ Theme guard: no off-palette colors.')
    process.exit(0)
  }

  const byFile = new Map<string, Violation[]>()
  for (const v of violations) {
    const list = byFile.get(v.rel) ?? []
    list.push(v)
    byFile.set(v.rel, list)
  }
  console.error(`✖ Theme guard: ${violations.length} off-palette / off-identity violation(s)\n`)
  for (const [file, vs] of [...byFile].toSorted()) {
    console.error(file)
    for (const v of vs.toSorted((a, b) => a.line - b.line)) {
      console.error(`  ${String(v.line).padStart(4)}  ${v.kind.padEnd(18)} ${v.token}`)
    }
    console.error('')
  }
  console.error(
    'Fix: route color through VX.* / the Mantine theme; for an off-identity accent use blue/gray or ' +
      'a status hue (red/green/orange/yellow); for raw spacing/radius use the scale token. Add a ' +
      '`theme-allow` comment for a deliberate exception.',
  )
  process.exit(1)
}

/** Scaffold basalt-ui into a project. Not yet implemented (S5). */
export function init(): void {
  console.log('basalt-ui init: not yet implemented (S5).')
  process.exit(0)
}

/** Sync basalt-ui scaffolding / tokens into a project. Not yet implemented (S5). */
export function sync(): void {
  console.log('basalt-ui sync: not yet implemented (S5).')
  process.exit(0)
}
