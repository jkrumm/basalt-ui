/**
 * The aside never shows a record its URL does not name (shell cycle 3, P1 shell-3.1), in a real
 * browser at 1800 on the v3 fixture (`fixture/v3/scenarios/stale-aside.ts`): a `SplitPage` over a
 * deploys table whose rows open in a `PageAside` bound to `?deploy=`. After each navigation that
 * drops or outlives the field, no record is left in the aside:
 * - the crumb parent unsets `deploy`: the aside closes;
 * - the rail link unsets `service` and `deploy`: the table unmounts and the aside closes;
 * - a list pick keeps `deploy`, which the other service's rows lack: it is cleared and the aside closes.
 *
 * v3 only.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import type { StaleAsideSpec } from './fixture/v3/scenarios/stale-aside'
import { LAYOUT_TARGET } from './shell-slots'
import { closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const layout = ready && LAYOUT_TARGET === 'v3' ? describe : describe.skip

const WIDE: Viewport = { name: 'wide', width: 1800, height: 900 }
const SPEC: StaleAsideSpec = { sections: [], staleAside: {} }

const ASIDE = '[data-slot="page-aside"]'
const BODY = '[data-testid="deploy-body"]'
const ROW = 'tbody tr'

async function openRecord() {
  const page = await openFixture(SPEC, WIDE)
  await page.waitFor(ROW)
  // The row's first cell: the v3 fixture loads no table sheet, so the filler past the last column draws
  // no row cell and a tap at the row's centre would land on the table.
  await page.tap(`${ROW} td`)
  await page.waitFor(`${ASIDE} ${BODY}`)
  return page
}

/** The aside's record and the address bar, after the page settled. */
const state = async (page: Awaited<ReturnType<typeof openRecord>>) => {
  await page.quiesce()
  return {
    records: await page.count(`${ASIDE} ${BODY}`),
    search: await page.raw.evaluate(() => window.location.search),
  }
}

layout('the aside follows its field at 1800', () => {
  test('opening a row shows its record and writes the field', async () => {
    const page = await openRecord()
    expect(await state(page)).toEqual({
      records: 1,
      search: '?service=checkout&deploy=checkout-093',
    })
  })

  test('the crumb parent unsets the field and closes the aside', async () => {
    const page = await openRecord()
    await page.tap('[data-testid="crumb-parent"]')
    expect(await state(page)).toEqual({ records: 0, search: '?service=checkout' })
    expect(await page.count(ASIDE)).toBe(0)
  })

  test('the rail link unmounts the table and closes the aside', async () => {
    const page = await openRecord()
    await page.tap('[data-testid="rail-services"]')
    expect(await state(page)).toEqual({ records: 0, search: '' })
    expect(await page.count(ASIDE)).toBe(0)
  })

  test('picking another service drops a record its rows lack', async () => {
    const page = await openRecord()
    await page.tap('[data-testid="pick-billing"]')
    expect(await state(page)).toEqual({ records: 0, search: '?service=billing' })
    expect(await page.count(ASIDE)).toBe(0)
  })
})
