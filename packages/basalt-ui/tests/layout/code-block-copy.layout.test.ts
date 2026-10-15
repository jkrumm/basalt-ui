/**
 * Layout invariants for the CodeBlock copy button (ledger row 75): the first code line never sits
 * under the button — highlighted or in the unhighlighted fallback, with or without a header — the
 * reserve equals offset + the rendered button, the fallback and highlighted fences are the same
 * height (no jump on the swap), and the outer paragraph → fence → paragraph rhythm stays the 18px
 * block gap Prose owns. Rect intersection is geometry, independent of the
 * button's hover opacity — the fixture context is touch (always visible), and a long first line is
 * the case that reaches the button's corner on desktop hover.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Box, Viewport } from './harness'
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

const withBlock = (codeBlock: NonNullable<FixtureSpec['codeBlock']>): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  codeBlock,
})
const SPEC = withBlock({})
const SPEC_TITLED = withBlock({ title: 'config.ts' })
const SPEC_FALLBACK = withBlock({ language: null })
const SPEC_NO_COPY = withBlock({ showCopy: false })

const BLOCK_GAP = 18
const TOLERANCE = 0.5
const BODY = moduleClass('body')
const HIGHLIGHTED = `${BODY} pre.shiki`
const COPY = 'button[aria-label="Copy code"]'

type Page = Awaited<ReturnType<typeof openFixture>>

const intersects = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

async function open(spec: FixtureSpec, viewport: Viewport, highlighted = true): Promise<Page> {
  const p = await openFixture(spec, viewport)
  // The fallback state is measured BEFORE shiki resolves would be racy; `language` omitted never
  // highlights, which is the same plain `<pre>` the streaming state renders.
  if (highlighted) await p.waitFor(HIGHLIGHTED)
  await p.settle()
  return p
}

/** The first LINE's rect: it spans the whole (long) line, not its first glyph — the line runs
 * under the button horizontally whenever it is longer than the box. */
async function firstLineRect(p: Page): Promise<Box> {
  return p.raw.evaluate((sel) => {
    const body = document.querySelector(sel)
    if (!body) throw new Error('no code body')
    const text = document.createTreeWalker(body, NodeFilter.SHOW_TEXT).nextNode()
    if (!text) throw new Error('no code text')
    const range = document.createRange()
    range.selectNodeContents(text)
    const r = range.getClientRects()[0]
    if (!r) throw new Error('no first line rect')
    const { x, y, left, right, top, bottom, width, height } = r
    return { x, y, left, right, top, bottom, width, height }
  }, BODY)
}

const px = async (p: Page, selector: string, property: string): Promise<number> =>
  Number.parseFloat(await p.computed(selector, property))

const fenceHeight = async (p: Page): Promise<number> =>
  (await p.boxes(moduleClass('container')))[0]?.height ?? Number.NaN

layout('CodeBlock copy button clearance', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['phone 390 (touch, button always visible)', PHONE, SPEC, true],
    ['desktop 1440', DESKTOP_1440, SPEC, true],
    ['phone 390 with header', PHONE, SPEC_TITLED, true],
    ['desktop 1440 with header', DESKTOP_1440, SPEC_TITLED, true],
    ['phone 390, unhighlighted fallback', PHONE, SPEC_FALLBACK, false],
    ['desktop 1440, unhighlighted fallback', DESKTOP_1440, SPEC_FALLBACK, false],
  ])('%s: the first line is clear of the copy button', async (_name, viewport, spec, hl) => {
    const p = await open(spec, viewport, hl)
    const button = (await p.boxes(COPY))[0]
    if (!button) throw new Error('no copy button')
    expect(intersects(button, await firstLineRect(p))).toBe(false)
  })

  test('the reserve equals offset + the rendered button, in both directions', async () => {
    const p = await open(SPEC, PHONE)
    const button = (await p.boxes(COPY))[0]
    if (!button) throw new Error('no copy button')
    const offset = await px(p, moduleClass('floatingCopy'), 'top')
    const reserve = (await px(p, BODY, 'padding-top')) - offset
    expect(Math.abs(reserve - button.height)).toBeLessThanOrEqual(TOLERANCE)
  })

  test('the fallback and the highlighted fence are the same height (no jump on the swap)', async () => {
    const highlighted = await fenceHeight(await open(SPEC, PHONE))
    const fallback = await fenceHeight(await open(SPEC_FALLBACK, PHONE, false))
    expect(Math.abs(fallback - highlighted)).toBeLessThanOrEqual(TOLERANCE)
  })

  test('a titled fence keeps the symmetric body padding', async () => {
    const p = await open(SPEC_TITLED, PHONE)
    expect(await px(p, BODY, 'padding-top')).toBe(await px(p, BODY, 'padding-bottom'))
  })

  test('a title-less fence with showCopy={false} reserves nothing', async () => {
    const p = await open(SPEC_NO_COPY, PHONE)
    expect(await p.count(COPY)).toBe(0)
    expect(await px(p, BODY, 'padding-top')).toBe(await px(p, BODY, 'padding-bottom'))
  })

  test('the outer rhythm stays the block gap on both edges', async () => {
    const p = await open(SPEC, PHONE)
    const before = (await p.boxes('[data-testid="codeblock-before"]'))[0]
    const fence = (await p.boxes(moduleClass('container')))[0]
    const after = (await p.boxes('[data-testid="codeblock-after"]'))[0]
    if (!before || !fence || !after) throw new Error('missing boxes')
    expect(fence.top - before.bottom).toBe(BLOCK_GAP)
    expect(after.top - fence.bottom).toBe(BLOCK_GAP)
  })
})
