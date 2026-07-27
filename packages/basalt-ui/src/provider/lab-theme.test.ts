/**
 * The theme lab's theme-OBJECT seam (`./lab-theme.ts`).
 *
 * The lab used to apply a config through a `<style>` tag alone, which can only move CSS custom
 * properties — so the Radius/Density sliders moved the CSS-module-styled surfaces and left
 * `theme.radius`/`theme.spacing` and every numeric `defaultProps` frozen at level 0. Two things have
 * to hold for the tool to be honest, and both are asserted here:
 *
 * 1. The delta an active override contributes really carries the theme-object numbers (`radius`,
 *    `spacing`, the `defaultProps` `buildTheme` bakes in), so they follow the sliders.
 * 2. It carries NOTHING ELSE — no function-valued field (fresh closure per `buildTheme` call, would
 *    clobber a consumer's own `vars`/`classNames`), and no field the config doesn't actually move.
 *    That second half is what lets the delta be merged LAST, over a consumer theme, without eating
 *    the consumer's overrides.
 *
 * Expected values are read from `deriveRadius`/`deriveSpacing` rather than hardcoded — the LAW is
 * locked by `theme/radius.test.ts` + `theme/spacing.test.ts`; what this file locks is that the law's
 * output reaches the theme object the provider hands to `MantineProvider`.
 */
import { describe, expect, test } from 'bun:test'
import { applyLabOverride, themeOverrideDelta } from './lab-theme'
import { baseTheme, createBasaltTheme } from '../theme'
import { pxRem } from '../tokens'
import { DEFAULT_DERIVE_CONFIG } from '../tokens/derive'
import { deriveRadius, deriveSpacing } from '../tokens/palette'
import type { DeriveOverride } from '../theme-lab/derive-state'

const at = (radiusLevel: number, densityLevel: number): DeriveOverride => ({
  config: DEFAULT_DERIVE_CONFIG,
  radiusLevel,
  densityLevel,
})

/** Read a dotted path out of a partial theme without a cast at every assertion. */
const pick = (theme: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, theme)

describe('themeOverrideDelta', () => {
  test('a theme against itself yields an empty override', () => {
    expect(themeOverrideDelta(baseTheme, baseTheme)).toEqual({})
  })

  test('two independently built default themes still yield an empty override', () => {
    // The guard against a false-positive delta: `buildTheme` allocates fresh `vars`/`classNames`
    // closures every call, so a reference-comparing diff would report dozens of changed fields for
    // two configs that are in fact identical — and then clobber them on every consumer.
    expect(themeOverrideDelta(createBasaltTheme(), createBasaltTheme())).toEqual({})
  })

  test('never carries a function-valued field', () => {
    const delta = themeOverrideDelta(baseTheme, createBasaltTheme(undefined, { radius: -2 }))
    const functions: string[] = []
    const walk = (node: unknown, path: string): void => {
      if (typeof node === 'function') functions.push(path)
      if (node === null || typeof node !== 'object' || Array.isArray(node)) return
      for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key)
    }
    walk(delta, '')
    expect(functions).toEqual([])
  })
})

describe('a radius override reaches the theme object', () => {
  const delta = themeOverrideDelta(baseTheme, createBasaltTheme(undefined, { radius: -2 }))
  const radius = deriveRadius(-2)

  test('the Mantine radius scale moves', () => {
    expect(pick(delta, 'radius.md')).toBe(pxRem(radius.ctrl))
  })

  test("Badge's numeric defaultProps radius moves — the case a <style> tag can never reach", () => {
    expect(pick(delta, 'components.Badge.defaultProps.radius')).toBe(radius.ctrl)
  })

  test('the floating tier moves with it (Tooltip/Popover/Modal/Notification)', () => {
    expect(pick(delta, 'components.Tooltip.defaultProps.radius')).toBe(radius.floating)
    expect(pick(delta, 'components.Popover.defaultProps.radius')).toBe(radius.floating)
    expect(pick(delta, 'components.Modal.defaultProps.radius')).toBe(radius.floating)
    expect(pick(delta, 'components.Notification.defaultProps.radius')).toBe(radius.floating)
  })

  test('Card/Paper are NOT in it — they read var(--vx-radius-card), so the CSS half owns them', () => {
    expect(pick(delta, 'components.Card')).toBeUndefined()
    expect(pick(delta, 'components.Paper')).toBeUndefined()
  })

  test('the resolved values ride along for the provider to inject as CSS', () => {
    expect(pick(delta, 'other.basaltRadius')).toEqual(radius)
  })

  test('spacing is untouched — a radius level moves radius only', () => {
    expect(pick(delta, 'spacing')).toBeUndefined()
    expect(pick(delta, 'other.basaltDensity')).toBeUndefined()
  })
})

describe('a density override reaches the theme object', () => {
  const delta = themeOverrideDelta(baseTheme, createBasaltTheme(undefined, { density: -1 }))
  const spacing = deriveSpacing(-1)

  test("theme.spacing moves — every p='md' / gap='sm' in the app follows", () => {
    expect(pick(delta, 'spacing.md')).toBe(pxRem(spacing.scale.md))
  })

  test("Timeline's bulletSize and Progress's size move", () => {
    expect(pick(delta, 'components.Timeline.defaultProps.bulletSize')).toBe(
      spacing.step.timelineBullet,
    )
    expect(pick(delta, 'components.Progress.defaultProps.size')).toBe(spacing.step.progressBarSize)
  })

  test('the resolved values ride along for the provider to inject as CSS', () => {
    expect(pick(delta, 'other.basaltDensity')).toEqual(spacing)
  })
})

describe('applyLabOverride', () => {
  test('no override → the consumer theme merged onto the base, exactly as before', () => {
    expect(applyLabOverride(undefined, null)).toBe(baseTheme)
    expect(applyLabOverride({ primaryColor: 'teal' }, null)).toEqual(
      createBasaltTheme({ primaryColor: 'teal' }),
    )
  })

  test('an override at level 0 with the default palette changes nothing', () => {
    expect(applyLabOverride(undefined, at(0, 0))).toEqual(baseTheme)
  })

  test('the override wins over a consumer theme that bakes in level-0 numbers', () => {
    // The documented mount is `theme={createBasaltTheme()}` — a COMPLETE theme carrying every
    // level-0 number. Merged last (which is `BasaltProvider`'s contract) it would clobber the lab
    // right back to level 0; the delta is what out-cascades it.
    const resolved = applyLabOverride(createBasaltTheme(), at(-2, -1))
    expect(pick(resolved, 'components.Badge.defaultProps.radius')).toBe(deriveRadius(-2).ctrl)
    expect(pick(resolved, 'spacing.md')).toBe(pxRem(deriveSpacing(-1).scale.md))
  })

  test("a consumer's own unrelated overrides survive the override", () => {
    const resolved = applyLabOverride({ primaryColor: 'teal', other: { myFlag: true } }, at(-2, -1))
    expect(pick(resolved, 'primaryColor')).toBe('teal')
    expect(pick(resolved, 'other.myFlag')).toBe(true)
    expect(pick(resolved, 'components.Badge.defaultProps.radius')).toBe(deriveRadius(-2).ctrl)
  })
})
