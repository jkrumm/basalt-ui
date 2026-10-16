/**
 * `createBasaltTheme` before vs after the `X.extend()` → `ext<typeof X>()` change: the same output.
 *
 * Skipped unless `BASALT_BASELINE_SRC` points at the `src/` of a checkout of the code BEFORE the
 * change, with its dependencies installed:
 *
 *   git worktree add /tmp/basalt-baseline $(git merge-base HEAD origin/master)
 *   (cd /tmp/basalt-baseline && bun install --frozen-lockfile)
 *   BASALT_BASELINE_SRC=/tmp/basalt-baseline/packages/basalt-ui/src bun test scripts/theme-equivalence
 *   git worktree remove --force /tmp/basalt-baseline
 *
 * Plain data is deep-compared. Every function-valued entry (`vars`, `classNames`, `styles`,
 * `variantColorResolver`) is INVOKED in both trees over sizes × variants × states × schemes and the
 * results compared, so a changed resolver body fails here, not only a changed key. The structural
 * snapshot in `src/theme/plain-theme.test.ts` is the ongoing guard once the baseline is gone.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineThemeOverride } from '@mantine/core'
import { join } from 'node:path'
import * as current from '../src/theme/index'

const BASELINE = process.env['BASALT_BASELINE_SRC']

type ThemeModule = typeof current
type Options = NonNullable<Parameters<typeof current.createBasaltTheme>[1]>

const OPTIONS: ReadonlyArray<readonly [string, Options | undefined]> = [
  ['default', undefined],
  ['density -3', { density: -3 }],
  ['density 0', { density: 0 }],
  ['density +3', { density: 3 }],
  ['radius -5', { radius: -5 }],
  ['radius 0', { radius: 0 }],
  ['radius +5', { radius: 5 }],
  ['derive accent', { derive: { accent: '#d9480f' } }],
  ['all knobs', { derive: { accent: '#0b7285' }, radius: 3, density: -2 }],
]

const SIZES = [undefined, 'xs', 'sm', 'md', 'lg', 'xl', 'ctl', 'icon']
const VARIANTS = [
  undefined,
  'filled',
  'light',
  'outline',
  'subtle',
  'default',
  'transparent',
  'white',
]
const COLORS = [undefined, 'blue', 'red', 'gray', 'dark', 'accent']
const SCHEMES = ['light', 'dark'] as const

/** Props probes for `(theme, props, ctx)` resolvers: size × variant × checked × color × scheme. */
function propProbes(): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  for (const size of SIZES)
    for (const variant of VARIANTS)
      for (const checked of [undefined, true, false])
        for (const color of COLORS) out.push({ size, variant, checked, color, radius: undefined })
  out.push({ iconColor: 'red' }, { iconColor: 'var(--x)', size: 'md' }, { autoContrast: true })
  return out
}

/** Invoke a function-valued entry across its probes; errors are results too (they must also match). */
function invoke(path: string, fn: unknown, theme: unknown): unknown[] {
  if (typeof fn !== 'function') return []
  const call = (...args: unknown[]): unknown => {
    try {
      return normalize((fn as (...a: unknown[]) => unknown)(...args), theme)
    } catch (error) {
      return { threw: String(error) }
    }
  }
  if (path.endsWith('variantColorResolver')) {
    return VARIANTS.flatMap((variant) =>
      COLORS.flatMap((color) =>
        [false, true].map((autoContrast) =>
          call({ color, theme, variant, gradient: undefined, autoContrast }),
        ),
      ),
    )
  }
  return SCHEMES.flatMap((scheme) => propProbes().map((props) => call(theme, props, { scheme })))
}

/** Replace functions by their source text and, at a known entry, by what they return. */
function normalize(
  value: unknown,
  theme: unknown,
  path = '',
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === 'function') {
    const isResolver = /\.(vars|classNames|styles|variantColorResolver)$/.test(path)
    return {
      fn: String(value),
      ...(isResolver ? { calls: invoke(path, value, theme) } : {}),
    }
  }
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((v, i) => normalize(v, theme, `${path}[${i}]`, seen))
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, normalize(v, theme, `${path}.${k}`, seen)]),
  )
}

function resolved(override: MantineThemeOverride): unknown {
  return mergeMantineTheme(DEFAULT_THEME, override)
}

describe.skipIf(BASELINE === undefined)('createBasaltTheme matches the pre-change code', () => {
  let baseline = current
  beforeAll(async () => {
    baseline = (await import(join(BASELINE ?? '', 'theme/index'))) as ThemeModule
  })

  test.each(OPTIONS)('%s', (_, options) => {
    const before = baseline.createBasaltTheme(undefined, options)
    const after = current.createBasaltTheme(undefined, options)
    const probeTheme = resolved(after)
    expect(normalize(after, probeTheme)).toEqual(normalize(before, probeTheme))
  })

  test('baseTheme and CTL_THEME', () => {
    const probeTheme = resolved(current.baseTheme)
    expect(normalize(current.baseTheme, probeTheme)).toEqual(
      normalize(baseline.baseTheme, probeTheme),
    )
    expect(normalize(current.CTL_THEME, probeTheme)).toEqual(
      normalize(baseline.CTL_THEME, probeTheme),
    )
  })

  test('cssVariablesResolver', () => {
    for (const options of OPTIONS.map(([, o]) => o)) {
      const theme = resolved(current.createBasaltTheme(undefined, options))
      expect(normalize(current.cssVariablesResolver(theme as never), theme)).toEqual(
        normalize(baseline.cssVariablesResolver(theme as never), theme),
      )
    }
  })

  test('the probes reach real resolvers (not vacuous)', () => {
    const calls = JSON.stringify(normalize(current.baseTheme, resolved(current.baseTheme)))
    expect(calls).toContain('--input-height')
    expect(calls).toContain('--button-height')
    expect(calls).toContain('--tl-icon-color')
  })
})
