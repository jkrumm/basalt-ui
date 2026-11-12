/**
 * One look: a static tokens page and a bridge (Tailwind) page read the same five atoms.
 *
 * Contract: docs/v3/concepts/static-framework-free.md section 8 (P6 `one-look`) and
 * tokens-visual section 8. The tokens page is `test/fixtures/tokens` (plain CSS over the four
 * entries, no bundler); the bridge page is the `test/fixtures/bridge` Tailwind build. Chrome
 * resolves both and the computed styles of every atom must be identical in light and in dark.
 *
 * Chrome only. Firefox and Safari are NOT run here: their `color-mix()` serialization and
 * `var()`-in-attribute behaviour are unverified (static-framework-free, row U).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { Page } from 'playwright-core'
import {
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  DESKTOP_1440,
  initLayoutSuite,
  openDocument,
} from '../harness'
import { ATOMS } from './atoms'
import type { Atom } from './atoms'
import { bridgePage, tokensPage } from './pages'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip
afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

type Reading = Record<string, Record<string, string>>

/**
 * typography.css's reduced-motion reset sets `transition-duration: 0.01ms` on everything, and the
 * harness runs `reduce`. `transition-property` defaults to `all`, so a scheme flip still starts a
 * transition and a read in the same frame returns the OLD value. Two frames let it finish.
 */
async function stamp(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.evaluate(async (theme) => {
    // eslint-disable-next-line unicorn/consistent-function-scoping -- serialized into the page
    const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))
    document.documentElement.setAttribute('data-theme', theme)
    await frame()
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
    await frame()
  }, scheme)
}

/**
 * Tailwind's `shadow-*` utilities compose the value with four zero-size transparent ring layers
 * (`--tw-inset-shadow`, `--tw-ring-shadow`, ...), so the serialized strings differ while nothing
 * paints differently. The comparison drops those empty layers.
 */
function paintedShadow(value: string): string {
  const layers: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i <= value.length; i++) {
    const ch = value[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if ((ch === ',' && depth === 0) || i === value.length) {
      layers.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  const empty = /^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px( inset)?$/
  return layers.filter((layer) => !empty.test(layer)).join(', ')
}

/** Stamps `scheme` on <html> and reads every atom's compared properties. */
async function readAtoms(page: Page, scheme: 'light' | 'dark'): Promise<Reading> {
  await stamp(page, scheme)
  const atoms = ATOMS.filter((a) => a.group !== 'ring').map((a: Atom) => ({
    id: a.id,
    props: [...a.props],
  }))
  return page.evaluate(
    ({ list }) => {
      const out: Record<string, Record<string, string>> = {}
      for (const { id, props } of list) {
        const style = getComputedStyle(document.getElementById(id) as Element)
        const row: Record<string, string> = {}
        for (const prop of props)
          row[prop] = (style as unknown as Record<string, string>)[prop] ?? ''
        out[id] = row
      }
      return out
    },
    { list: atoms },
  )
}

/** Tab to the single focusable probe and read its outline: the ring atom. */
async function readRing(page: Page, scheme: 'light' | 'dark'): Promise<Record<string, string>> {
  await stamp(page, scheme)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Tab')
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  )
  const props = ATOMS.find((a) => a.id === 'ring')?.props ?? []
  return page.evaluate(
    (names) => {
      const style = getComputedStyle(document.getElementById('ring') as Element)
      const row: Record<string, string> = {}
      for (const name of names) row[name] = (style as unknown as Record<string, string>)[name] ?? ''
      return row
    },
    [...props],
  )
}

layout('one look: tokens page vs bridge page', () => {
  for (const scheme of ['light', 'dark'] as const) {
    describe(scheme, () => {
      let tokens: Reading = {}
      let bridge: Reading = {}
      let tokensRing: Record<string, string> = {}
      let bridgeRing: Record<string, string> = {}

      test('both pages resolve', async () => {
        const a = await openDocument(tokensPage({ withAtoms: true }), DESKTOP_1440)
        const b = await openDocument(await bridgePage(), DESKTOP_1440)
        tokens = await readAtoms(a.raw, scheme)
        bridge = await readAtoms(b.raw, scheme)
        tokensRing = await readRing(a.raw, scheme)
        bridgeRing = await readRing(b.raw, scheme)
        expect(Object.keys(tokens).length).toBe(Object.keys(bridge).length)
        expect(Object.keys(tokens).length).toBeGreaterThan(15)
      })

      for (const group of ['surface', 'ink', 'type', 'radius', 'shadow'] as const) {
        test(`${group} atoms agree`, () => {
          const diffs: string[] = []
          for (const atom of ATOMS.filter((a) => a.group === group)) {
            for (const prop of atom.props) {
              const norm = group === 'shadow' ? paintedShadow : (v: string): string => v
              const t = norm(tokens[atom.id]?.[prop] ?? '')
              const b = norm(bridge[atom.id]?.[prop] ?? '')
              if (!t || t === b) {
                if (!t) diffs.push(`${atom.id}.${prop}: tokens page read nothing`)
                continue
              }
              diffs.push(`${atom.id}.${prop}: tokens page "${t}" vs bridge page "${b}"`)
            }
          }
          expect(diffs).toEqual([])
        })
      }

      test('ring atom agrees', () => {
        expect(tokensRing['outlineStyle']).toBe('solid')
        expect(tokensRing['outlineWidth']).toBe('2px')
        expect(bridgeRing).toEqual(tokensRing)
      })
    })
  }

  test('the atoms are not trivially equal: the schemes differ and the ladder is real', async () => {
    const page = await openDocument(tokensPage({ withAtoms: true }), DESKTOP_1440)
    const light = await readAtoms(page.raw, 'light')
    const dark = await readAtoms(page.raw, 'dark')
    expect(light['surface-canvas']?.['backgroundColor']).not.toBe(
      dark['surface-canvas']?.['backgroundColor'],
    )
    expect(light['ink-ink']?.['color']).not.toBe(dark['ink-ink']?.['color'])
    expect(light['type-micro']?.['fontSize']).toBe('11px')
    expect(light['type-base']?.['fontSize']).toBe('16px')
    expect(light['radius-card']?.['borderTopLeftRadius']).not.toBe('0px')
  })
})
