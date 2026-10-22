/**
 * Wave 44: the lazy virtual-rows seam in real Chrome — what happy-dom cannot see.
 * - A sticky group header stays on screen after the list scrolls 2000 px past its natural position.
 * - A prepend with `anchorTo: 'end'` holds the previously first-visible row at the same on-screen
 *   offset (stable `row.key`s are what make this work).
 * - `scroll: 'parent'` virtualises against `AppShell.Main`, the shell's scrollport.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  MAIN,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const HOST = '[data-testid="vr-host"]'
const SCROLL = `${HOST} > div`
/** Sub-pixel slack on a measured offset, px. */
const EPS = 2

const spec = (mode: 'height' | 'parent'): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  virtualRows: mode,
})

layout('Wave 44 virtual-rows seam', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('a sticky header is still at the top of the list after scrolling 2000 px', async () => {
    const p = await openFixture(spec('height'), DESKTOP_1440)
    await p.raw.waitForSelector(`${SCROLL} [data-vr-row]`)
    await p.raw.evaluate((sel) => {
      ;(document.querySelector(sel) as HTMLElement).scrollTop = 2000
    }, SCROLL)
    await p.raw.waitForTimeout(250)
    const { top, headerTop, headers, position } = await p.raw.evaluate((sel) => {
      const box = document.querySelector(sel) as HTMLElement
      const header = box.querySelector('[data-vr-header]') as HTMLElement | null
      return {
        top: box.getBoundingClientRect().top,
        headerTop: header?.parentElement?.getBoundingClientRect().top ?? Number.NaN,
        headers: box.querySelectorAll('[data-vr-header]').length,
        position: header ? getComputedStyle(header.parentElement as HTMLElement).position : '',
      }
    }, SCROLL)
    expect(headers).toBeGreaterThan(0)
    expect(position).toBe('sticky')
    expect(Math.abs(headerTop - top)).toBeLessThanOrEqual(EPS)
  })

  test('prepending 50 rows with anchorTo end keeps the first visible row where it was', async () => {
    const p = await openFixture(spec('height'), DESKTOP_1440)
    await p.raw.waitForSelector(`${SCROLL} [data-vr-row]`)
    await p.raw.evaluate((sel) => {
      ;(document.querySelector(sel) as HTMLElement).scrollTop = 3000
    }, SCROLL)
    await p.raw.waitForTimeout(250)
    const probe = (sel: string, id?: string) => {
      const box = document.querySelector(sel) as HTMLElement
      const boxTop = box.getBoundingClientRect().top
      const rows = [...box.querySelectorAll<HTMLElement>('[data-vr-row]')]
      const el = id
        ? rows.find((r) => r.dataset['testid'] === id)
        : rows.find((r) => r.getBoundingClientRect().top >= boxTop)
      return el
        ? { id: el.dataset['testid'] ?? '', offset: el.getBoundingClientRect().top - boxTop }
        : null
    }
    const before = await p.raw.evaluate(probe, SCROLL)
    expect(before).not.toBeNull()
    await p.raw.evaluate(() => window.basaltVrPrepend?.(50))
    await p.raw.waitForTimeout(400)
    const after = await p.raw.evaluate(
      ([sel, id]) => {
        const box = document.querySelector(sel as string) as HTMLElement
        const boxTop = box.getBoundingClientRect().top
        const el = [...box.querySelectorAll<HTMLElement>('[data-vr-row]')].find(
          (r) => r.dataset['testid'] === id,
        )
        return el ? el.getBoundingClientRect().top - boxTop : null
      },
      [SCROLL, before?.id] as const,
    )
    expect(after).not.toBeNull()
    expect(Math.abs((after ?? 0) - (before?.offset ?? 0))).toBeLessThanOrEqual(EPS)
  })

  test("scroll: 'parent' windows against the shell scrollport", async () => {
    const p = await openFixture(spec('parent'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [data-vr-row]`)
    const { rendered, scrollable } = await p.raw.evaluate(
      ([host, main]) => {
        const m = document.querySelector(main as string) as HTMLElement
        return {
          rendered: document.querySelectorAll(
            `${host as string} [data-vr-row], ${host as string} [data-vr-header]`,
          ).length,
          scrollable: m.scrollHeight > m.clientHeight,
        }
      },
      [HOST, MAIN] as const,
    )
    expect(scrollable).toBe(true)
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(300)
  })
})
