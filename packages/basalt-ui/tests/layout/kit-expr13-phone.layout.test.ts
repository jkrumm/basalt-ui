/**
 * Expression cycle 13 kit fixes, the phone fields grid (`phone: 'fields'`; `v3-expr-13-kit-fixes` 10): at 390 a mono entity's value
 * stays on its label's line, and a card's values start on the card's content edge, with no cell
 * padding of their own. Fixture: `fixture/kit-expr13-phone-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('phone', 'expr13')
})
afterAll(() => doc?.cleanup())

type Card = {
  titleOffset: number
  titleCellOffset: number
  idCellOffset: number
  idValueLine: number
  idCellHeight: number
  idCentreGap: number
  idEndOffset: number
}

const card = (): Promise<Card> =>
  doc
    ? openFixture(EMPTY_SPEC, PHONE, doc.path, 'reduce', 'fine').then(async (page) => {
        await page.raw.waitForSelector('[data-testid="k13-phone"] tbody tr')
        await page.settle()
        return page.raw.evaluate(() => {
          const row = document.querySelector(
            '[data-testid="k13-phone"] tbody [data-slot="table-row"]',
          )!
          const cell = (label: string) =>
            row.querySelector<HTMLElement>(`[data-slot="table-cell"][data-label="${label}"]`)!
          const title = row.querySelector<HTMLElement>('[data-identity]')!
          const titleCell = title.getBoundingClientRect()
          const titleEntity = title
            .querySelector('[data-slot="table-entity"]')!
            .getBoundingClientRect()
          const id = cell('Id')
          const idRect = id.getBoundingClientRect()
          const idEntity = id.querySelector('[data-slot="table-entity"]')!.getBoundingClientRect()
          const edge =
            row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft)
          const edgeRight =
            row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight)
          return {
            titleOffset: titleEntity.left - titleCell.left,
            titleCellOffset: titleCell.left - edge,
            idCellOffset: idRect.left - edge,
            idValueLine: idEntity.top - idRect.top,
            idCellHeight: idRect.height,
            idCentreGap: Math.abs(
              idRect.top + idRect.height / 2 - (titleCell.top + titleCell.height / 2),
            ),
            idEndOffset: edgeRight - idRect.right,
          }
        })
      })
    : Promise.reject(new Error('fixture not built'))

layout(
  'a phone fields row keeps its mono id on the title line and its values on the content edge',
  () => {
    test('the id sits on the title line, not on a labelled line of its own', async () => {
      const c = await card()
      expect(c.idCentreGap).toBeLessThan(3)
      expect(c.idCellHeight).toBeLessThan(30)
    })

    test('the identity title starts on the card content edge, with no indent of its own', async () => {
      const c = await card()
      expect(c.titleOffset).toBe(0)
    })

    test('the id ends on the card content edge and the title starts on it', async () => {
      const c = await card()
      expect(c.idEndOffset).toBe(0)
      expect(c.titleCellOffset).toBe(0)
    })
  },
)
