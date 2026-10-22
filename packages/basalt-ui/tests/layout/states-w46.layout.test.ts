/**
 * Wave 46: the states and the two Left-behind fixes, in real Chrome.
 * - An empty `EventList` and an empty `Board` column are the same `EmptyState` tile: one ring (a shadow,
 *   no border), the card radius, the title at `md` 500 and the description at `sm`.
 * - The board card's record link is ink in both schemes (never the browser's link blue).
 * - A chips-only, time-less journal row keeps its chips on the sentence's line at 1440 and 390.
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

const SECTIONS: FixtureSpec['sections'] = [
  { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
]
const EL = '[data-testid="el-host"]'
const BOARD = '[data-testid="board-host"]'
const RECORD_HOST = '[data-testid="board-record-host"]'
/** `EmptyState`'s title (`md`) and a column or table title's size (`sm`), in computed px. */
const TITLE_MD = '15px'
const TITLE_SM = '13px'
/** The ring over its backdrop must move a channel by at least this much (of 255). */
const RING_MIN_DELTA = 12
const BROWSER_LINK_BLUE = 'rgb(0, 0, 238)'

type Tile = {
  shadow: string
  borderTop: string
  radius: string
  cardRadius: string
  titleSize: string
  titleWeight: string
  descSize: string
}

/** In-page: the computed anatomy of the `EmptyState` whose title reads `text`, inside `host`. */
const tileOf = (host: string, text: string): string => `(() => {
  const title = [...document.querySelectorAll('${host} span')].find((s) => s.textContent === ${JSON.stringify(text)})
  if (!title) throw new Error('LAYOUT: no EmptyState title ' + ${JSON.stringify(text)})
  const root = title.parentElement
  const cs = getComputedStyle(root)
  const probe = document.createElement('div')
  probe.style.borderRadius = 'var(--vx-radius-card)'
  document.body.append(probe)
  const cardRadius = getComputedStyle(probe).borderTopLeftRadius
  probe.remove()
  const desc = title.nextElementSibling
  return {
    shadow: cs.boxShadow, borderTop: cs.borderTopWidth, radius: cs.borderTopLeftRadius, cardRadius,
    titleSize: getComputedStyle(title).fontSize, titleWeight: getComputedStyle(title).fontWeight,
    descSize: desc ? getComputedStyle(desc).fontSize : '',
  }
})()`

function expectTile(t: Tile, titleSize = TITLE_MD): void {
  expect(t.shadow).not.toBe('none')
  expect(t.borderTop).toBe('0px')
  expect(t.radius).toBe(t.cardRadius)
  expect(t.titleSize).toBe(titleSize)
  expect(t.titleWeight).toBe('500')
}

layout('Wave 46 states', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('an empty EventList is the section tile: one ring, card radius, md 500 title', async () => {
    const p = await openFixture({ sections: SECTIONS, eventList: 'empty' }, DESKTOP_1440)
    await p.raw.waitForSelector(`${EL} [role="status"] span`)
    const t = (await p.raw.evaluate(tileOf(EL, 'Nothing has happened yet'))) as Tile
    expectTile(t)
  })

  test('an empty Board column is the same tile', async () => {
    const p = await openFixture({ sections: SECTIONS, board: 'columns' }, DESKTOP_1440)
    await p.raw.waitForSelector(`${BOARD} [role="group"]`)
    const t = (await p.raw.evaluate(tileOf(BOARD, 'Nothing is blocked'))) as Tile
    // The column title is the card-title size (sm), never louder than the cards beside it.
    expectTile(t, TITLE_SM)
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: the empty column tile's ring shows against the page`, async () => {
      const p = await openFixture({ sections: SECTIONS, board: 'columns' }, DESKTOP_1440)
      await p.raw.waitForSelector(`${BOARD} [role="group"]`)
      await p.raw.evaluate(
        `document.documentElement.setAttribute('data-mantine-color-scheme', '${scheme}')`,
      )
      const delta = (await p.raw.evaluate(`(() => {
        const title = [...document.querySelectorAll('${BOARD} span')].find((s) => s.textContent === 'Nothing is blocked')
        if (!title) throw new Error('LAYOUT: no empty column tile')
        const tile = title.parentElement
        const rgba = (css) => {
          const probe = document.createElement('span')
          probe.style.color = css
          document.body.append(probe)
          const c = getComputedStyle(probe).color
          probe.remove()
          const n = c.match(/-?[\\d.]+/g).map(Number)
          return c.startsWith('color(') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : [n[0], n[1], n[2], n[3] ?? 1]
        }
        let bgEl = tile
        let bg = [0, 0, 0, 0]
        while (bgEl && bg[3] === 0) { bg = rgba(getComputedStyle(bgEl).backgroundColor); bgEl = bgEl.parentElement }
        const ringCss = getComputedStyle(tile).boxShadow.match(/(rgba?\\([^)]*\\)|color\\([^)]*\\))/)[1]
        const ring = rgba(ringCss)
        const over = ring.slice(0, 3).map((c, i) => c * ring[3] + bg[i] * (1 - ring[3]))
        return Math.max(...over.map((c, i) => Math.abs(c - bg[i])))
      })()`)) as number
      expect(delta).toBeGreaterThanOrEqual(RING_MIN_DELTA)
    })
  }

  test('the empty tile title is the same size at 390 as at 1440', async () => {
    const size = async (vp: typeof PHONE) => {
      const p = await openFixture({ sections: SECTIONS, eventList: 'empty' }, vp)
      await p.raw.waitForSelector(`${EL} [role="status"] span`)
      return ((await p.raw.evaluate(tileOf(EL, 'Nothing has happened yet'))) as Tile).titleSize
    }
    expect(await size(PHONE)).toBe(await size(DESKTOP_1440))
  })

  for (const vp of [DESKTOP_1440, PHONE]) {
    test(`${vp.width}: a table error is left-aligned with the table title size`, async () => {
      const p = await openFixture(
        {
          sections: SECTIONS,
          table: { rows: 8, columns: 3, stickyHeader: false, error: true },
        },
        vp,
      )
      await p.raw.waitForSelector('table [role="alert"]')
      const r = (await p.raw.evaluate(`(() => {
        const alert = document.querySelector('table [role="alert"]')
        const td = alert.closest('td').getBoundingClientRect()
        const first = alert.firstElementChild.getBoundingClientRect()
        const title = alert.querySelector('.mantine-Text-root')
        return { titleSize: getComputedStyle(title).fontSize, offset: first.left - td.left, tdWidth: td.width, align: getComputedStyle(alert).alignItems, textAlign: getComputedStyle(alert).textAlign }
      })()`)) as {
        titleSize: string
        offset: number
        tdWidth: number
        align: string
        textAlign: string
      }
      expect(r.titleSize).toBe(TITLE_MD)
      expect(r.align).not.toBe('center')
      expect(r.textAlign).not.toBe('center')
      expect(r.offset).toBeLessThan(r.tdWidth / 4)
    })
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: the board record link is ink, not the browser link blue`, async () => {
      const p = await openFixture({ sections: SECTIONS, w46BoardRecord: true }, DESKTOP_1440)
      await p.raw.waitForSelector(`${RECORD_HOST} a[href="#record-482"]`)
      await p.raw.evaluate(
        `document.documentElement.setAttribute('data-mantine-color-scheme', '${scheme}')`,
      )
      const r = (await p.raw.evaluate(`(() => {
        const a = document.querySelector('${RECORD_HOST} a[href="#record-482"]')
        const ink = document.createElement('span')
        ink.style.color = 'var(--vx-ink)'
        document.body.append(ink)
        const out = { link: getComputedStyle(a).color, ink: getComputedStyle(ink).color }
        ink.remove()
        return out
      })()`)) as { link: string; ink: string }
      expect(r.link).toBe(r.ink)
      expect(r.link).not.toBe(BROWSER_LINK_BLUE)
    })
  }

  test('the record link keeps a visible keyboard focus indicator', async () => {
    const p = await openFixture({ sections: SECTIONS, w46BoardRecord: true }, DESKTOP_1440)
    await p.raw.waitForSelector(`${RECORD_HOST} a[href="#record-482"]`)
    let focused = false
    for (let i = 0; i < 12 && !focused; i++) {
      await p.raw.keyboard.press('Tab')
      focused = (await p.raw.evaluate(
        `document.activeElement?.matches('${RECORD_HOST} a[href="#record-482"]') ?? false`,
      )) as boolean
    }
    expect(focused).toBe(true)
    const r = (await p.raw.evaluate(`(() => {
      const cs = getComputedStyle(document.activeElement)
      return { style: cs.outlineStyle, width: cs.outlineWidth }
    })()`)) as { style: string; width: string }
    expect(r.style).not.toBe('none')
    expect(r.width).not.toBe('0px')
  })

  for (const vp of [DESKTOP_1440, PHONE]) {
    test(`${vp.width}: a chips-only, time-less row keeps its chip on the sentence's line`, async () => {
      const p = await openFixture({ sections: SECTIONS, eventList: 'untimed' }, vp)
      await p.raw.waitForSelector(`${EL} ${moduleClass('chips')}`)
      // The fixture has no chips-only row: shape one from a real row the way `EventListRow` renders it.
      const r = (await p.raw.evaluate(`(() => {
        const row = document.querySelector('${EL} ${moduleClass('chips')}').closest('${moduleClass('row')}')
        row.querySelector('${moduleClass('body')}')?.remove()
        row.setAttribute('data-chips-only', '')
        const line = row.querySelector('${moduleClass('line')}').getBoundingClientRect()
        const chips = row.querySelector('${moduleClass('chips')}').getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(row.querySelector('${moduleClass('line')}'))
        const lineTextRight = Math.max(...[...range.getClientRects()].map((q) => q.right))
        return { lineTextRight, chipsLeft: chips.left, lineTop: line.top, lineBottom: line.bottom, chipsTop: chips.top, rowRight: row.getBoundingClientRect().right, chipsRight: chips.right }
      })()`)) as Record<string, number>
      expect(r['chipsTop']).toBeLessThan(r['lineBottom'] as number)
      // ...and right after the sentence's last word, not pinned to the row's far edge.
      expect((r['chipsLeft'] as number) - (r['lineTextRight'] as number)).toBeLessThanOrEqual(24)
      expect(r['chipsRight']).toBeLessThanOrEqual((r['rowRight'] as number) + 1)
    })
  }
})
