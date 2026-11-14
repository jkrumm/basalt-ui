/**
 * P7 extended (docs/v3/concepts/ai-mdx.md rows 15 and P11; Issue v3-ai-i9-recipes): the ai-card
 * recipe's `DataPanel` is as tall `loading` (no token yet), `streaming` (a summary growing past the
 * body box) and `settled` as it is at rest (drift <= 2 px) at 1800x1200 and 390x844, and its
 * summary never overflows the card sideways.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildAiBlockDocument } from './ai-block-build'
import {
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const VIEWPORTS: readonly Viewport[] = [
  { name: 'desktop 1800', width: 1800, height: 1200 },
  { name: 'phone 390', width: 390, height: 844 },
]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const DRIFT_PX = 2
const FIXTURE = '../../../../apps/playground/src/recipes/ai-card-fixture.tsx'
const PANEL = '[data-slot="data-panel"]'
const PARAGRAPH = 'The week closed with more shipped than opened, and the backlog fell. '.repeat(3)

let documentPath = ''
let dispose = (): void => undefined

beforeAll(async () => {
  if (!ready) return
  const built = await buildAiBlockDocument(FIXTURE, 'ai-card')
  documentPath = serveDocument(built.html)
  dispose = built.dispose
})

afterAll(() => dispose())

type Probe = { height: number; phase: string | null; state: string | null; overflowX: boolean }

layout('P7: the ai-card DataPanel holds its height from loading to settled', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: loading, streaming and settled within ${DRIFT_PX} px`, async () => {
      const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
      await page.raw.waitForSelector(PANEL)
      const probe = (): Promise<Probe> =>
        page.raw.evaluate((sel) => {
          const panel = document.querySelector<HTMLElement>(sel)!
          return {
            height: panel.getBoundingClientRect().height,
            phase: panel.querySelector('[data-phase]')?.getAttribute('data-phase') ?? null,
            state: panel.querySelector('[data-state]')?.getAttribute('data-state') ?? null,
            overflowX: panel.scrollWidth > panel.clientWidth + 1,
          }
        }, PANEL)
      const act = (call: string): Promise<unknown> => page.raw.evaluate(`window.aiCard.${call}`)

      const loading = await probe()
      expect(loading.phase, 'loading phase').toBe('loading')

      await act('open()')
      await act('push("First words of the summary. ")')
      await page.raw.waitForSelector('[data-state="streaming"]')
      const first = await probe()
      expect(first.phase, 'first token is ready').toBe('ready')

      for (let i = 0; i < 12; i++) await act(`push(${JSON.stringify(`${PARAGRAPH}\n\n`)})`)
      await page.raw.waitForFunction(
        () => (document.querySelector('[data-state="streaming"]')?.textContent?.length ?? 0) > 1500,
      )
      const streaming = await probe()

      await act('end()')
      await page.raw.waitForSelector('[data-state="settled"]')
      const settled = await probe()

      for (const [name, p] of Object.entries({ first, streaming, settled })) {
        expect(
          Math.abs(p.height - loading.height),
          `${name} ${p.height} vs loading ${loading.height}`,
        ).toBeLessThanOrEqual(DRIFT_PX)
        expect(p.overflowX, `${name} overflows sideways`).toBe(false)
      }
    })
  }
})
