/**
 * Expression cycle 14, the phone row's mono id (`v3-expr-14-kit-fixes` 7e, n61): at 390 a mono entity's id is a
 * muted value under the row's title, set in the mono face, with no header label of its own. Fixture:
 * `fixture/kit-expr14-phone-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('phone', 'expr14')
})
afterAll(() => doc?.cleanup())

type Card = {
  idTop: number
  titleTop: number
  idLabelText: string
  idMono: boolean
  idUnderTitle: boolean
}

const card = (): Promise<Card> =>
  doc
    ? openFixture(EMPTY_SPEC, PHONE, doc.path, 'reduce', 'fine').then(async (page: LayoutPage) => {
        await page.raw.waitForSelector('[data-testid="k14-phone"] tbody tr')
        await page.settle()
        return page.raw.evaluate(() => {
          const row = document.querySelector(
            '[data-testid="k14-phone"] tbody [data-slot="table-row"]',
          )!
          const title = row.querySelector<HTMLElement>('[data-identity]')!
          const id = row.querySelector<HTMLElement>('[data-slot="table-cell"][data-label="Id"]')!
          const name = id.querySelector<HTMLElement>('[data-slot="table-entity-name"]')!
          const titleBox = title.getBoundingClientRect()
          const idBox = id.getBoundingClientRect()
          return {
            idTop: idBox.top + idBox.height / 2,
            titleTop: titleBox.top + titleBox.height / 2,
            idLabelText: getComputedStyle(id, '::before').content,
            idMono: getComputedStyle(name).fontFamily.includes('Mono'),
            idUnderTitle: idBox.top >= titleBox.bottom - 1,
          }
        })
      })
    : Promise.reject(new Error('fixture not built'))

layout('a phone row shows a mono entity id under its title, in mono', () => {
  test('the id sits on the muted line under the title', async () => {
    const c = await card()
    expect(c.idUnderTitle).toBe(true)
  })

  test('the id is set in the mono face', async () => {
    const c = await card()
    expect(c.idMono).toBe(true)
  })

  test('the id draws no "Id:" label of its own', async () => {
    const c = await card()
    expect(c.idLabelText === 'none' || c.idLabelText === 'normal').toBe(true)
  })
})
