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

/** Resolves once `read()` returns the same value on two reads 120 ms apart — dynamic measurement
 * keeps nudging offsets for a few frames after a scroll, and a snapshot taken mid-flux is the flake. */
async function stable<T>(read: () => Promise<T>): Promise<T> {
  let prev = JSON.stringify(await read())
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 120))
    const next = await read()
    if (JSON.stringify(next) === prev) return next
    prev = JSON.stringify(next)
  }
  throw new Error('LAYOUT: virtual-rows geometry never settled')
}

const spec = (mode: NonNullable<FixtureSpec['virtualRows']>): FixtureSpec => ({
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
    const before = await stable(() => p.raw.evaluate(probe, SCROLL))
    expect(before).not.toBeNull()
    await p.raw.evaluate(() => window.basaltVrPrepend?.(50))
    const after = await stable(() =>
      p.raw.evaluate(
        ([sel, id]) => {
          const box = document.querySelector(sel as string) as HTMLElement
          const boxTop = box.getBoundingClientRect().top
          const el = [...box.querySelectorAll<HTMLElement>('[data-vr-row]')].find(
            (r) => r.dataset['testid'] === id,
          )
          return el ? el.getBoundingClientRect().top - boxTop : null
        },
        [SCROLL, before?.id] as const,
      ),
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

  test('growing a block above a parent-mode list after mount keeps the rows tiled on screen', async () => {
    const p = await openFixture(spec('parent-grow'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [data-vr-row]`)
    await p.raw.evaluate(() => window.basaltVrGrow?.(700))
    await p.raw.waitForTimeout(300)
    // Scroll past the grown block: a stale offset would window the rows 660 px off the viewport.
    await p.raw.evaluate((main) => {
      ;(document.querySelector(main) as HTMLElement).scrollTop = 1500
    }, MAIN)
    await p.raw.waitForTimeout(300)
    const geo = await p.raw.evaluate(
      ([host, main]) => {
        const m = (document.querySelector(main as string) as HTMLElement).getBoundingClientRect()
        const rows = [
          ...document.querySelectorAll<HTMLElement>(
            `${host as string} [data-vr-row], ${host as string} [data-vr-header]`,
          ),
        ]
          .map((r) => r.getBoundingClientRect())
          .sort((a, b) => a.top - b.top)
        return {
          mainTop: m.top,
          mainBottom: m.bottom,
          first: rows[0]?.top ?? Number.NaN,
          last: rows.at(-1)?.bottom ?? Number.NaN,
          maxGap: Math.max(0, ...rows.slice(1).map((r, i) => r.top - (rows[i]?.bottom ?? 0))),
        }
      },
      [HOST, MAIN] as const,
    )
    expect(geo.first).toBeLessThanOrEqual(geo.mainTop + EPS)
    expect(geo.last).toBeGreaterThanOrEqual(geo.mainBottom - EPS)
    expect(geo.maxGap).toBeLessThanOrEqual(EPS)
  })
})
