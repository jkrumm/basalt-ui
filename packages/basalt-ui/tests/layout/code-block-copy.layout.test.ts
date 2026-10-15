/**
 * Layout invariants for the CodeBlock copy button (ledger row 75): the first code line never sits
 * under the button, with or without a header, and the outer paragraph → fence → paragraph rhythm
 * stays the 18px block gap Prose owns. Rect intersection is geometry, independent of the
 * button's hover opacity — the fixture context is touch (always visible), and a long first line is
 * the case that reaches the button's corner on desktop hover.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { Box } from './harness'
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

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  codeBlock: {},
}
const SPEC_TITLED: FixtureSpec = { ...SPEC, codeBlock: { title: 'config.ts' } }

const BLOCK_GAP = 18
const BODY = moduleClass('body')
// The highlighted body (`pre.shiki`, margin 0) is the 2.x shape the clearance regressed on; the
// plain `<pre>` fallback still inherits Prose's block margin and is not.
const HIGHLIGHTED = `${BODY} pre.shiki`

const intersects = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * The first LINE's rect — shiki's `span.line`, which spans the whole (long) line, not its first
 * glyph: the line runs under the button horizontally whenever it is longer than the box.
 */
async function firstLineRect(p: Awaited<ReturnType<typeof openFixture>>): Promise<Box> {
  const [line] = await p.boxes(`${HIGHLIGHTED} .line`)
  if (!line) throw new Error('no first code line')
  return line
}

layout('CodeBlock copy button clearance', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['phone 390 (touch, button always visible)', PHONE, SPEC],
    ['desktop 1440', DESKTOP_1440, SPEC],
    ['phone 390 with header', PHONE, SPEC_TITLED],
    ['desktop 1440 with header', DESKTOP_1440, SPEC_TITLED],
  ])('%s: the first line is clear of the copy button', async (_name, viewport, spec) => {
    const p = await openFixture(spec, viewport)
    await p.waitFor(HIGHLIGHTED)
    await p.settle()
    const button = (await p.boxes('button[aria-label="Copy code"]'))[0]
    if (!button) throw new Error('no copy button')
    const line = await firstLineRect(p)
    expect(intersects(button, line)).toBe(false)
  })

  test('the outer rhythm stays the block gap on both edges', async () => {
    const p = await openFixture(SPEC, PHONE)
    await p.waitFor(HIGHLIGHTED)
    await p.settle()
    const before = (await p.boxes('[data-testid="codeblock-before"]'))[0]
    const fence = (await p.boxes(`${moduleClass('container')}`))[0]
    const after = (await p.boxes('[data-testid="codeblock-after"]'))[0]
    if (!before || !fence || !after) throw new Error('missing boxes')
    expect(fence.top - before.bottom).toBe(BLOCK_GAP)
    expect(after.top - fence.bottom).toBe(BLOCK_GAP)
  })
})
