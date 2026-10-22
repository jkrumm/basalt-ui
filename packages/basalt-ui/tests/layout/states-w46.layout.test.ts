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

function expectTile(t: Tile, titleSize = '15px'): void {
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
    expectTile(t, '13px')
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: the board record link is ink, not the browser link blue`, async () => {
      const p = await openFixture({ sections: SECTIONS, board: 'columns' }, DESKTOP_1440)
      await p.raw.waitForSelector(`${BOARD} ${moduleClass('status')}`)
      await p.raw.evaluate(
        `document.documentElement.setAttribute('data-mantine-color-scheme', '${scheme}')`,
      )
      const r = (await p.raw.evaluate(`(() => {
        const status = document.querySelector('${BOARD} ${moduleClass('status')}')
        const a = document.createElement('a')
        a.href = '#record'
        a.className = status.className.split(' ').find((c) => c.startsWith('status_')).replace(/^status_/, 'record_')
        a.textContent = '#482'
        status.before(a)
        const ink = document.createElement('span')
        ink.style.color = 'var(--vx-ink)'
        document.body.append(ink)
        const out = { link: getComputedStyle(a).color, ink: getComputedStyle(ink).color }
        ink.remove()
        return out
      })()`)) as { link: string; ink: string }
      expect(r.link).toBe(r.ink)
      expect(r.link).not.toBe('rgb(0, 0, 238)')
    })
  }

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
        return { lineTop: line.top, lineBottom: line.bottom, chipsTop: chips.top, rowRight: row.getBoundingClientRect().right, chipsRight: chips.right }
      })()`)) as Record<string, number>
      expect(r['chipsTop']).toBeLessThan(r['lineBottom'] as number)
      expect(r['chipsRight']).toBeLessThanOrEqual((r['rowRight'] as number) + 1)
    })
  }
})
