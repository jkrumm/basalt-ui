/**
 * Wave 44: `EventList` in real Chrome — what happy-dom cannot see.
 * - The active day header stays rendered and at the top of the scroller after scrolling, plain and windowed.
 * - Prepending earlier events (oldest-first) keeps the first visible row within a few px, plain and windowed.
 * - At 390 and 1440 the time leads the meta line, under the sentence's start; a long note wraps, never an ellipsis.
 * - A long feed sentence wraps at both sizes (lists-w53).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  moduleClass,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const HOST = '[data-testid="el-host"]'
const EPS = 2

const spec = (mode: NonNullable<FixtureSpec['eventList']>): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  eventList: mode,
})

/** Resolves once `read()` returns the same value twice, 120 ms apart (dynamic measurement settles over frames). */
async function stable<T>(read: () => Promise<T>): Promise<T> {
  let prev = JSON.stringify(await read())
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 120))
    const next = await read()
    if (JSON.stringify(next) === prev) return next
    prev = JSON.stringify(next)
  }
  throw new Error('LAYOUT: event-list geometry never settled')
}

/** In-page: the scroller of the first `<time>` (nearest overflow:auto ancestor). */
const SCROLLER = `(() => {
  let el = document.querySelector('${HOST} time')?.parentElement ?? null
  while (el && !['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) el = el.parentElement
  return el
})()`

async function scrollTo(p: Awaited<ReturnType<typeof openFixture>>, top: number): Promise<void> {
  await p.raw.evaluate(`(${SCROLLER}).scrollTop = ${top}`)
  await p.raw.waitForTimeout(250)
}

layout('Wave 44 EventList', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const mode of ['plain', 'virtual'] as const) {
    test(`${mode}: the day header is sticky at the top after scrolling`, async () => {
      const p = await openFixture(spec(mode), DESKTOP_1440)
      await p.raw.waitForSelector(`${HOST} time`)
      // Mid-day in the third group, wherever the wrapped rows put it: not on a header hand-off.
      const top = (await p.raw.evaluate(`(() => {
        const box = ${SCROLLER}
        const h = box.querySelectorAll('[data-day-header]')[2]
        return h ? h.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop + 150 : 1500
      })()`)) as number
      await scrollTo(p, top)
      const r = await stable(() =>
        p.raw.evaluate(`(() => {
          const box = ${SCROLLER}
          const top = box.getBoundingClientRect().top
          const headers = [...box.querySelectorAll('[data-day-header]')]
          const at = headers.find((h) => Math.abs(h.getBoundingClientRect().top - top) <= ${EPS})
          return { count: headers.length, times: box.querySelectorAll('time').length, found: Boolean(at) }
        })()`),
      )
      expect((r as { found: boolean }).found).toBe(true)
      expect((r as { count: number }).count).toBeGreaterThan(0)
      if (mode === 'virtual') {
        expect((r as { times: number }).times).toBeLessThan(120)
        const heading = (await p.raw.evaluate(`(() => {
          const h = document.querySelector('${HOST} [data-day-header]')
          return [h.getAttribute('role'), h.getAttribute('aria-level'), h.parentElement.getAttribute('role')]
        })()`)) as string[]
        expect(heading).toEqual(['heading', '3', 'listitem'])
      }
    })
  }

  for (const mode of ['plain-oldest', 'virtual-oldest'] as const) {
    test(`${mode}: prepending earlier events keeps the first visible row in place`, async () => {
      const p = await openFixture(spec(mode), DESKTOP_1440)
      await p.raw.waitForSelector(`${HOST} time`)
      await p.raw.waitForTimeout(400)
      await scrollTo(p, mode === 'plain-oldest' ? 600 : 900)
      const probe = `(() => {
        const box = ${SCROLLER}
        const boxTop = box.getBoundingClientRect().top
        const times = [...box.querySelectorAll('time')]
        const t = times.find((x) => x.getBoundingClientRect().top >= boxTop + 40)
        return t ? { id: t.dateTime, offset: t.getBoundingClientRect().top - boxTop } : null
      })()`
      const before = (await stable(() => p.raw.evaluate(probe))) as {
        id: string
        offset: number
      } | null
      if (before === null) throw new Error('LAYOUT: no visible row before the prepend')
      await p.raw.evaluate(() => window.basaltElPrepend?.(40))
      // The anchor lands a frame or more after the prepend (the seam re-resolves the row by key), and a
      // starved browser can hold the un-anchored state past a fixed settle window: poll for the anchored
      // offset instead of trusting two equal reads, and fail only if it never arrives.
      const read = () =>
        p.raw.evaluate(`(() => {
          const box = ${SCROLLER}
          const t = [...box.querySelectorAll('time')].find((x) => x.dateTime === '${before.id}')
          return t ? t.getBoundingClientRect().top - box.getBoundingClientRect().top : null
        })()`) as Promise<number | null>
      let after = await read()
      for (let i = 0; i < 40 && Math.abs((after ?? Infinity) - before.offset) > EPS; i++) {
        await new Promise((r) => setTimeout(r, 100))
        after = await read()
      }
      expect(after).not.toBeNull()
      expect(Math.abs((after ?? 0) - before.offset)).toBeLessThanOrEqual(EPS)
    })
  }

  for (const [name, viewport] of [
    ['390', PHONE],
    ['1440', DESKTOP_1440],
  ] as const) {
    test(`${name}: the time leads the meta line, under the sentence's start; line one gets the full width`, async () => {
      const p = await openFixture(spec('plain'), viewport)
      await p.raw.waitForSelector(`${HOST} time`)
      const rows = (await p.raw.evaluate(`(() =>
        [...document.querySelectorAll('${HOST} time')].slice(0, 8).map((t) => {
          const row = t.parentElement
          const line = row.querySelector('${moduleClass('line')}')
          const tr = t.getBoundingClientRect()
          const lr = line.getBoundingClientRect()
          return {
            lineHeight: lr.height, lh: parseFloat(getComputedStyle(line).lineHeight),
            timeLeft: tr.left, timeTop: tr.top, lineLeft: lr.left, lineBottom: lr.bottom,
            lineRight: lr.right, rowRight: row.getBoundingClientRect().right,
          }
        }))()`)) as {
        lineHeight: number
        lh: number
        timeLeft: number
        timeTop: number
        lineLeft: number
        lineBottom: number
        lineRight: number
        rowRight: number
      }[]
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        expect(Math.abs(r.timeLeft - r.lineLeft)).toBeLessThanOrEqual(EPS)
        expect(r.timeTop).toBeGreaterThanOrEqual(r.lineBottom - 1)
        expect(r.lineRight).toBeGreaterThanOrEqual(r.rowRight - EPS)
      }
    })
  }

  test('390: a long note wraps on the meta line — never an ellipsis, the full text in the box', async () => {
    const p = await openFixture(spec('wrap'), PHONE)
    await p.raw.waitForSelector(`${HOST} ${moduleClass('body')}`)
    const r = (await p.raw.evaluate(`(() => {
      const body = document.querySelector('${HOST} ${moduleClass('body')}')
      const cs = getComputedStyle(body)
      const lh = parseFloat(cs.lineHeight)
      return {
        overflow: cs.textOverflow, whiteSpace: cs.whiteSpace, fits: body.scrollWidth <= body.clientWidth + 1,
        height: body.getBoundingClientRect().height, lh, text: body.textContent,
        right: body.getBoundingClientRect().right, rowRight: body.closest('${moduleClass('row')}').getBoundingClientRect().right,
        chipTop: body.closest('${moduleClass('row')}').querySelector('${moduleClass('chips')}').getBoundingClientRect().top,
        bodyBottom: body.getBoundingClientRect().bottom,
      }
    })()`)) as Record<string, string | number | boolean>
    expect(r['overflow']).not.toBe('ellipsis')
    expect(r['whiteSpace']).not.toBe('nowrap')
    expect(r['fits']).toBe(true)
    expect(Number(r['height'])).toBeGreaterThan(Number(r['lh']) * 1.5)
    expect(String(r['text'])).toContain('then re-ran every dependent report')
    expect(Number(r['right'])).toBeLessThanOrEqual(Number(r['rowRight']) + 1)
    // The chips have their own line under the note (Wave 50), never after its last word.
    expect(Number(r['chipTop'])).toBeGreaterThanOrEqual(Number(r['bodyBottom']) - 1)
  })

  test('390: the chips start under the note, whatever the note length', async () => {
    const p = await openFixture(spec('wrap-sweep'), PHONE)
    await p.raw.waitForSelector(`${HOST} ${moduleClass('chips')}`)
    const rows = (await p.raw.evaluate(`(() =>
      [...document.querySelectorAll('${HOST} ${moduleClass('chips')}')].map((chips) => {
        const row = chips.closest('${moduleClass('row')}')
        const body = row.querySelector('${moduleClass('body')}').getBoundingClientRect()
        const c = chips.getBoundingClientRect()
        return { gap: c.top - body.bottom, x: c.left - row.querySelector('time').getBoundingClientRect().left }
      }))()`)) as { gap: number; x: number }[]
    expect(rows).toHaveLength(40)
    for (const r of rows) {
      expect(r.gap).toBeGreaterThanOrEqual(-1)
      expect(Math.abs(r.x)).toBeLessThanOrEqual(EPS)
    }
  })

  test('a skeleton after loaded rows keeps their height', async () => {
    const p = await openFixture(spec('plain'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    const height = `(() => (${SCROLLER}).firstElementChild.getBoundingClientRect().height)()`
    const before = (await p.raw.evaluate(height)) as number
    await p.raw.evaluate('window.basaltElLoading(true)')
    await p.raw.waitForTimeout(250)
    const during = (await p.raw.evaluate(
      `(() => document.querySelector('${HOST} [aria-busy]').parentElement.getBoundingClientRect().height)()`,
    )) as number
    expect(during).toBeGreaterThanOrEqual(before - 1)
  })

  test('a scroll box with rows below the fold paints the more-below fade', async () => {
    const p = await openFixture(spec('plain'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    const fade = (await p.raw.evaluate(`(() => {
      const el = ${SCROLLER}
      const after = getComputedStyle(el, '::after')
      return { more: el.hasAttribute('data-more'), content: after.content, position: after.position }
    })()`)) as { more: boolean; content: string; position: string }
    expect(fade.more).toBe(true)
    expect(fade.content).not.toBe('none')
    expect(fade.position).toBe('sticky')
  })

  test('1440: a feed row with a body and two chips is at most 80 px (line three holds the chips)', async () => {
    const p = await openFixture(spec('plain'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    const heights = (await p.raw.evaluate(`(() =>
      [...document.querySelectorAll('${HOST} ${moduleClass('chips')}')].slice(0, 6).map((c) => {
        const row = c.closest('${moduleClass('row')}')
        return row.getBoundingClientRect().height
      }))()`)) as number[]
    expect(heights.length).toBeGreaterThan(0)
    for (const h of heights) expect(h).toBeLessThanOrEqual(80)
  })

  test('the actor renders heavier than the sentence (the font really has a 500)', async () => {
    const p = await openFixture(spec('plain'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    const r = (await p.raw.evaluate(`(() => {
      const actor = document.querySelector('${HOST} ${moduleClass('actor')}')
      const cs = getComputedStyle(actor)
      const w500 = actor.getBoundingClientRect().width
      actor.style.fontWeight = '400'
      const w400 = actor.getBoundingClientRect().width
      actor.style.fontWeight = ''
      return { weight: cs.fontWeight, w500, w400 }
    })()`)) as { weight: string; w500: number; w400: number }
    expect(Number(r.weight)).toBeGreaterThanOrEqual(500)
    expect(r.w500 - r.w400).toBeGreaterThan(0.3)
  })

  test('the type scale is two sizes in the list: the row size and the micro size', async () => {
    const p = await openFixture(spec('timeline'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    const sizes = (await p.raw.evaluate(`(() => {
      const q = (sel) => [...document.querySelectorAll('${HOST} ' + sel)].map((e) => getComputedStyle(e).fontSize)
      return {
        actor: q('${moduleClass('actor')}'), body: q('${moduleClass('body')}'),
        time: q('time'), header: q('[data-day-header]'), chips: q('${moduleClass('chips')}'),
      }
    })()`)) as Record<string, string[]>
    const row = new Set([...(sizes['actor'] ?? []), ...(sizes['body'] ?? [])])
    const micro = new Set([
      ...(sizes['time'] ?? []),
      ...(sizes['header'] ?? []),
      ...(sizes['chips'] ?? []),
    ])
    expect(row.size).toBe(1)
    expect(micro.size).toBe(1)
    expect([...row][0]).not.toBe([...micro][0])
  })

  test('loading keeps the declared height box', async () => {
    const p = await openFixture(spec('loading'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [aria-busy="true"]`)
    const h = (await p.raw.evaluate(
      `document.querySelector('${HOST} [data-density] > div').getBoundingClientRect().height`,
    )) as number
    expect(Math.abs(h - 400)).toBeLessThanOrEqual(EPS)
  })

  test('crossing the 200-row threshold keeps the scroll node and does not reset to the top', async () => {
    const p = await openFixture(spec('threshold'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    await p.raw.evaluate(`window.__elNode = ${SCROLLER}`)
    await scrollTo(p, 1200)
    await p.raw.waitForTimeout(300)
    const before = (await p.raw.evaluate('window.__elNode.scrollTop')) as number
    await p.raw.evaluate(() => window.basaltElAppend?.(1))
    await p.raw.waitForTimeout(1500)
    const after = (await stable(() =>
      p.raw.evaluate(`(() => ({
        same: window.__elNode === document.querySelector('${HOST} [class*="scroll_"]'),
        windowed: window.__elNode.querySelectorAll('time').length < 120,
        top: window.__elNode.scrollTop,
        viewport: window.__elNode.clientHeight,
      }))()`),
    )) as { same: boolean; windowed: boolean; top: number; viewport: number }
    expect(after.same).toBe(true)
    expect(after.windowed).toBe(true)
    // It may land a few rows off, never at the top: within one viewport of where it was.
    expect(Math.abs(after.top - before)).toBeLessThanOrEqual(after.viewport)
  })

  test('an oldest-first list crossing 200 on an earlier load does not jump to the newest end', async () => {
    const p = await openFixture(spec('threshold-oldest'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    await p.raw.waitForTimeout(500)
    await scrollTo(p, 1500)
    await p.raw.evaluate(() => window.basaltElPrepend?.(1))
    await p.raw.waitForTimeout(1500)
    const r = (await stable(() =>
      p.raw.evaluate(`(() => {
        const box = document.querySelector('${HOST} [class*="scroll_"]')
        return { fromEnd: Math.round(box.scrollHeight - box.clientHeight - box.scrollTop), windowed: box.querySelectorAll('time').length < 120 }
      })()`),
    )) as { fromEnd: number; windowed: boolean }
    expect(r.windowed).toBe(true)
    expect(r.fromEnd).toBeGreaterThan(400)
  })

  test('390: a bounded oldest-first box opens on the newest row, fully visible, and the page ends with it', async () => {
    const p = await openFixture(spec('timeline-oldest'), PHONE)
    await p.raw.waitForSelector(`${HOST} time`)
    await p.raw.waitForTimeout(800)
    const r = (await p.raw.evaluate(`(() => {
      const box = ${SCROLLER}
      const rows = [...box.querySelectorAll('${moduleClass('row')}')]
      const last = rows[rows.length - 1].getBoundingClientRect()
      const b = box.getBoundingClientRect()
      const main = document.querySelector('[data-basalt-scrollport]')
      const host = document.querySelector('${HOST}').getBoundingClientRect()
      // The stuck day header's lower edge: no row may straddle it (a row cut across its first line).
      const header = [...box.querySelectorAll('[data-day-header]')].map((h) => h.getBoundingClientRect()).find((h) => h.top <= b.top + 1 && h.bottom > b.top)
      const straddling = header ? rows.filter((r) => { const q = r.getBoundingClientRect(); return q.top < header.bottom - 1 && q.bottom > header.bottom + 1 }).length : 0
      return {
        straddling,
        lastBottom: last.bottom, lastTop: last.top, boxTop: b.top, boxBottom: b.bottom,
        mainScroll: main.scrollHeight, mainClient: main.clientHeight, hostBottom: host.bottom - main.getBoundingClientRect().top + main.scrollTop,
      }
    })()`)) as Record<string, number>
    expect(r['straddling']).toBe(0)
    expect(r['lastBottom']).toBeLessThanOrEqual((r['boxBottom'] ?? 0) + 1)
    expect(r['lastTop']).toBeGreaterThanOrEqual((r['boxTop'] ?? 0) - 1)
    // The page is as tall as its content: nothing leaks scroll height below the list.
    expect(r['mainScroll'] ?? 0).toBeLessThanOrEqual(
      Math.max(r['mainClient'] ?? 0, (r['hostBottom'] ?? 0) + 80),
    )
  })

  test("Show earlier is a bordered control whose edge sits at the rows' start, with a clearly visible hover step; rows have none", async () => {
    const p = await openFixture(spec('plain'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    const bg = (sel: string) =>
      p.raw.evaluate(
        `getComputedStyle(document.querySelector(${JSON.stringify(sel)})).backgroundColor`,
      ) as Promise<string>
    // Computed colours come as rgb()/rgba() or color(srgb 0..1): normalise to 0..255, and read the
    // rest state as the first non-transparent background up the tree (the button is transparent).
    const channels = (css: string): number[] => {
      const n = (css.match(/[\d.]+(?:e-?\d+)?/g) ?? []).map(Number).slice(0, 3)
      return css.startsWith('color(') ? n.map((c) => c * 255) : n
    }
    const effective = (sel: string) =>
      p.raw.evaluate(`(() => {
        let el = document.querySelector(${JSON.stringify(sel)})
        while (el) {
          const c = getComputedStyle(el).backgroundColor
          if (!/rgba\\(.*, 0\\)$|^transparent$/.test(c)) return c
          el = el.parentElement
        }
        return 'rgb(255, 255, 255)'
      })()`) as Promise<string>
    const button = `${HOST} ${moduleClass('earlier')} button`
    const row = `${HOST} ${moduleClass('row')}`
    const start = (await p.raw.evaluate(`(() => {
      const r = document.querySelector(${JSON.stringify(row)}).getBoundingClientRect()
      return document.querySelector(${JSON.stringify(button)}).getBoundingClientRect().left - r.left
    })()`)) as number
    expect(Math.abs(start)).toBeLessThanOrEqual(EPS)
    const [btnRest, rowRest] = [await bg(button), await bg(row)]
    const effectiveRest = effective(button)
    await p.raw.hover(button)
    await p.raw.waitForTimeout(250)
    const hovered = await bg(button)
    expect(hovered).not.toBe(btnRest)
    // A step you can see: at least 12 channel points of difference in total.
    const rest = channels(await effectiveRest)
    const hot = channels(hovered)
    const delta = hot.reduce((sum, c, i) => sum + Math.abs(c - (rest[i] ?? c)), 0)
    expect(delta).toBeGreaterThanOrEqual(12)
    await p.raw.hover(row)
    await p.raw.waitForTimeout(250)
    expect(await bg(row)).toBe(rowRest)
  })

  test('an empty list is a ring-edged tile that sizes to its content inside a bounded box', async () => {
    const p = await openFixture(spec('empty'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [role="status"]`)
    const r = (await p.raw.evaluate(`(() => {
      const region = document.querySelector('${HOST} [role="status"]')
      const cs = getComputedStyle(region.lastElementChild)
      return { height: region.getBoundingClientRect().height, border: cs.borderTopWidth, ring: cs.boxShadow, host: document.querySelector('${HOST}').getBoundingClientRect().height }
    })()`)) as { height: number; border: string; ring: string; host: number }
    // Wave 46: the EmptyState tile paints one ring (a shadow), never a border on top of it.
    expect(r.border).toBe('0px')
    expect(r.ring).not.toBe('none')
    expect(r.height).toBeLessThan(300)
    expect(r.host).toBeLessThan(400)
  })

  test('loading skeletons fill the bounded height and carry a day-header bar', async () => {
    const p = await openFixture(spec('loading'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [aria-busy="true"]`)
    const r = (await p.raw.evaluate(`(() => {
      const box = document.querySelector('${HOST} [data-density] > div')
      return { scroll: box.scrollHeight, client: box.clientHeight, headers: box.querySelectorAll('[class*="skeletonHeader"]').length }
    })()`)) as { scroll: number; client: number; headers: number }
    expect(r.scroll).toBeGreaterThanOrEqual(r.client)
    expect(r.headers).toBeGreaterThan(0)
  })

  test('390: an untimed row has no time and its meta line starts under the sentence', async () => {
    const p = await openFixture(spec('untimed'), PHONE)
    await p.raw.waitForSelector(`${HOST} ${moduleClass('row')}`)
    const r = (await p.raw.evaluate(`(() => {
      const row = document.querySelector('${HOST} ${moduleClass('row')}:has(${moduleClass('meta')})')
      return {
        times: row.querySelectorAll('time').length,
        metaLeft: row.querySelector('${moduleClass('meta')}').getBoundingClientRect().left,
        lineLeft: row.querySelector('${moduleClass('line')}').getBoundingClientRect().left,
      }
    })()`)) as { times: number; metaLeft: number; lineLeft: number }
    expect(r.times).toBe(0)
    expect(Math.abs(r.metaLeft - r.lineLeft)).toBeLessThanOrEqual(EPS)
  })

  /** Scrolls the list to its end and returns the px between the last rendered row and the box bottom. */
  async function blankBelowLastRow(p: Awaited<ReturnType<typeof openFixture>>): Promise<number> {
    await p.raw.evaluate(`(() => { const b = ${SCROLLER}; b.scrollTop = b.scrollHeight })()`)
    await p.raw.waitForTimeout(700)
    return (await p.raw.evaluate(`(() => {
      const box = ${SCROLLER}
      const rows = [...box.querySelectorAll('[data-event-id]')]
      const last = rows[rows.length - 1].getBoundingClientRect()
      return box.getBoundingClientRect().bottom - last.bottom
    })()`)) as number
  }

  test('a windowed list replaced by a shorter windowed list leaves no blank below its last row', async () => {
    const p = await openFixture(spec('virtual'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    await p.raw.waitForTimeout(500)
    await p.raw.evaluate(() => window.basaltElSet?.(220))
    await p.raw.waitForTimeout(800)
    expect(await blankBelowLastRow(p)).toBeLessThanOrEqual(24)
  })

  test('200 → empty → 201 leaves no blank below the last row, and the hold is released', async () => {
    const p = await openFixture(spec('threshold'), DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} time`)
    await p.raw.evaluate(() => window.basaltElSet?.(0))
    await p.raw.waitForSelector(`${HOST} [role="status"]`)
    await p.raw.evaluate(() => window.basaltElSet?.(201))
    await p.raw.waitForSelector(`${HOST} [data-index]`)
    await p.raw.waitForTimeout(800)
    expect(await blankBelowLastRow(p)).toBeLessThanOrEqual(24)
    const held = await p.raw.evaluate(`${SCROLLER}.style.getPropertyValue('--event-list-held')`)
    expect(held).toBe('')
  })
})
