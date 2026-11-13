/**
 * P7 (docs/v3/concepts/ai-mdx.md section 7; Issue v3-ai-i4): each block `sample` rendered through
 * `catalog.Block` is as tall `loading` as `ready` (drift <= 2 px) at 1800x1200 and 390x844, and
 * nothing overflows. `Block` hands the phase to the composite at the root of a render, so the
 * composite's own skeleton holds the height; no block declares `reserve`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildAiBlockDocument } from './ai-block-build'
import type { CaseReport } from './ai-block-fixture'
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
const CASES = ['stat-0', 'stat-1', 'list-0', 'list-1']

let documentPath = ''
let dispose = (): void => undefined

beforeAll(async () => {
  const built = await buildAiBlockDocument('ai-block-fixture.tsx', 'ai-block-phase')
  documentPath = serveDocument(built.html)
  dispose = built.dispose
})

afterAll(() => dispose())

async function measure(viewport: Viewport): Promise<CaseReport[]> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-case] [data-slot="ai-block"]')
  return page.raw.evaluate(() =>
    (window as unknown as { aiBlock: { cases: () => CaseReport[] } }).aiBlock.cases(),
  )
}

layout('P7: Block holds a sample’s height from loading to ready', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: loading and ready within ${DRIFT_PX} px, no overflow`, async () => {
      const reports = await measure(viewport)
      const height = new Map(reports.map((r) => [r.id, r.height]))
      for (const id of CASES) {
        const loading = height.get(`${id}:loading`)
        const settled = height.get(`${id}:ready`)
        expect(loading, `${id} loading rendered`).toBeGreaterThan(0)
        expect(settled, `${id} ready rendered`).toBeGreaterThan(0)
        expect(
          Math.abs(loading! - settled!),
          `${id}: ${loading} vs ${settled}`,
        ).toBeLessThanOrEqual(DRIFT_PX)
      }
      for (const r of reports) expect(r.overflows, `${r.id} overflows its box`).toBe(false)
    })
  }
})
