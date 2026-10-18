/**
 * Wave 37 chrome in a real browser: the disabled Button has a surface of its own in both schemes
 * (dark used to have none and read as the subtle variant), and the light Badge draws a status dot
 * for every colour form a caller can give while `variant="dot"` keeps its own.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const specFor = (colorScheme: 'light' | 'dark'): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  chromeW37: true,
})

type Probe = { bg: string; dotWidth: string; dotBg: string; dotContent: string }

const probe = (p: LayoutPage, id: string): Promise<Probe> =>
  p.raw.evaluate((testid) => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
    const style = getComputedStyle(el)
    const dot = getComputedStyle(el, '::before')
    return {
      bg: style.backgroundColor,
      dotWidth: dot.width,
      dotBg: dot.backgroundColor,
      dotContent: dot.content,
    }
  }, id)

layout('Wave 37 chrome', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: a disabled Button has a surface that is neither transparent nor the panel`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const panel = (await probe(p, 'w37-panel')).bg
      for (const id of ['w37-disabled', 'w37-disabled-filled']) {
        const { bg } = await probe(p, id)
        expect(bg).not.toBe('rgba(0, 0, 0, 0)')
        expect(bg).not.toBe(panel)
      }
    })

    test(`${scheme}: a light Badge draws its status dot for a theme, hex and indexed colour`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      for (const id of ['w37-badge-green', 'w37-badge-hex', 'w37-badge-indexed']) {
        const dot = await probe(p, id)
        expect(dot.dotContent).not.toBe('none')
        expect(dot.dotWidth).toBe('6px')
        expect(dot.dotBg).not.toBe('rgba(0, 0, 0, 0)')
      }
      expect((await probe(p, 'w37-badge-hex')).dotBg).toBe('rgb(224, 49, 49)')
    })

    test(`${scheme}: a module-styled head-face title (Callout) leads with the sans digit face`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const title = await p.raw.evaluate(() => {
        const root = document.querySelector('[data-testid="w37-callout"]')!
        const el = [...root.querySelectorAll<HTMLElement>('*')].find(
          (e) => e.textContent === 'Over 2026, 90 days' && e.children.length === 0,
        )!
        const style = getComputedStyle(el)
        return { family: style.fontFamily, features: style.fontFeatureSettings, tag: el.tagName }
      })
      expect(title.family).toMatch(/^"?Basalt Head Digits"?, "?Hubot Sans/)
      expect(title.tag).not.toMatch(/^H[1-6]$/)
      expect(title.features).not.toContain('"zero" 1')
    })

    test(`${scheme}: variant="dot" keeps its own dot`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const dot = await probe(p, 'w37-badge-dot')
      expect(dot.dotContent).not.toBe('none')
      expect(dot.dotBg).not.toBe('rgba(0, 0, 0, 0)')
    })
  }
})
