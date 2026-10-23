/**
 * Wave 50: a Board column that clips its cards shows the bottom fade (`EventList`'s scroll cue); a
 * column that fits, and a column scrolled to its end, show none.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const HOST = '[data-testid="board-host"]'
const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  board: 'columns',
}

type Fade = { clips: boolean; more: boolean; masked: boolean }

layout('Board column scroll fade', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  const read = (p: Awaited<ReturnType<typeof openFixture>>, scrollToEnd: boolean) =>
    p.raw.evaluate(
      ({ host, end }) => {
        const viewports = [...document.querySelectorAll(`${host} [role="group"]`)].map(
          (group) => group.querySelector('.mantine-ScrollArea-viewport') as HTMLElement,
        )
        if (end) viewports[0]!.scrollTop = viewports[0]!.scrollHeight
        return new Promise<Fade[]>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              resolve(
                viewports.map((v) => {
                  return {
                    clips: v.scrollHeight > v.clientHeight + 1,
                    more: v.hasAttribute('data-more'),
                    masked: getComputedStyle(v).maskImage !== 'none',
                  }
                }),
              ),
            ),
          ),
        )
      },
      { host: HOST, end: scrollToEnd },
    )

  test('1440: a clipping column paints the fade, a fitting one does not', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [role="group"]`)
    await p.quiesce()
    const columns = await read(p, false)
    expect(columns[0]!.clips).toBe(true)
    expect(columns[0]!.more).toBe(true)
    expect(columns[0]!.masked).toBe(true)
    const fitting = columns.at(-1)!
    expect(fitting.clips).toBe(false)
    expect(fitting.more).toBe(false)
    expect(fitting.masked).toBe(false)
  })

  test('1440: scrolled to its end the column drops the fade', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.raw.waitForSelector(`${HOST} [role="group"]`)
    await p.quiesce()
    const [column] = await read(p, true)
    expect(column!.more).toBe(false)
    expect(column!.masked).toBe(false)
  })
})
