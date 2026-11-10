/**
 * The harness's own test: the `data-slot` helpers resolve the right elements in a real Chrome, on a
 * tiny static page with no composite on it. Run with
 * `bun run test:layout:harness` — it is deliberately NOT part of `test:layout`, whose test count is
 * the suite's own and must not move when the engine does.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  handle,
  initLayoutSuite,
  openDocument,
  slot,
  slotChildOf,
  slotWithin,
} from './index'
import type { LayoutPage } from './index'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const PAGE = `<!doctype html>
<html>
  <body style="margin:0">
    <section data-slot="card" style="width:200px">
      <header data-slot="card-header" style="height:30px">
        <h2 data-slot="title" style="margin:0;height:20px">Card title</h2>
      </header>
      <div data-slot="card-content" style="height:60px">
        <p data-slot="title" style="margin:0;height:10px">Nested namesake</p>
      </div>
    </section>
    <div data-slot="dialog" role="dialog" style="width:100px;height:40px"></div>
    <main data-basalt-scrollport style="height:50px;overflow:auto">
      <div style="height:400px"></div>
    </main>
  </body>
</html>`

layout('data-slot helpers', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openDocument(PAGE, PHONE)
  }, CLOSE_BUDGET_MS)

  test('slot() builds an attribute selector that matches every element carrying the name', async () => {
    expect(slot('card-header')).toBe('[data-slot="card-header"]')
    expect(await p.count(slot('title'))).toBe(2)
    expect(await p.count(slot('absent'))).toBe(0)
  })

  test('slotWithin() scopes a namesake slot to its container, and measures the right box', async () => {
    expect(await p.count(slotWithin(slot('card-header'), 'title'))).toBe(1)
    const title = await p.box('title', slotWithin(slot('card-header'), 'title'))
    expect(title.box.height).toBe(20)
    const nested = await p.box('nested', slotWithin(slot('card-content'), 'title'))
    expect(nested.box.height).toBe(10)
  })

  test('slotChildOf() matches a direct child only', async () => {
    expect(await p.count(slotChildOf(slot('card'), 'card-header'))).toBe(1)
    expect(await p.count(slotChildOf(slot('card'), 'title'))).toBe(0)
  })

  test('handle() resolves a data-basalt-* attribute, and the engine reads Main through it', async () => {
    expect(handle('scrollport')).toBe('[data-basalt-scrollport]')
    expect(await p.count(handle('scrollport'))).toBe(1)
    const overflow = await p.horizontalOverflow()
    expect(overflow.main).not.toBeNull()
  })

  test('census() counts [role="dialog"] with no library registered by the page', async () => {
    const census = await p.census()
    expect(census.counts['[role="dialog"]']).toBe(1)
  })

  test('a selector that matches nothing fails loudly instead of measuring nothing', async () => {
    await expect(p.box('ghost', slot('absent'))).rejects.toThrow('LAYOUT: no element matched')
  })
})
