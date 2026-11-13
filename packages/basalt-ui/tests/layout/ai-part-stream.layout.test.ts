/**
 * P3 and S10 (docs/v3/concepts/ai-mdx.md section 7; Issue v3-ai-i3): `gap-perf` S1-S9 against the
 * recipe (a component-owned `useState(() => new Chat({transport}))` handed to `useChat({chat})`) in
 * real Chrome with the AI SDK's own `DefaultChatTransport` over a fake server, and S10: a streaming
 * `partView` under `ui/collapsible` or CSS-hide keeps every character. The one control, `useChat()`
 * with no `chat` under `<Activity>`, still truncates (S3): that is exactly what the lint sub-check
 * catches, so the recipe's pass is a property of the recipe and not of the harness.
 *
 * Every scenario reports through `window.aiPart.run`; see `ai-part-stream-fixture.tsx`. A stream is
 * 24 deltas of 25 ms and 86 characters.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildAiPartDocument } from './ai-part-build'
import type { StreamReport, StreamSpec } from './ai-part-stream-fixture'
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

const DESKTOP: Viewport = { name: 'desktop 1800', width: 1800, height: 1200 }
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TEXT_LENGTH = 86
const DELTA_COUNT = 24

let documentPath = ''
let dispose = (): void => undefined

beforeAll(async () => {
  const built = await buildAiPartDocument('ai-part-stream-fixture.tsx', 'ai-part-stream')
  documentPath = serveDocument(built.html)
  dispose = built.dispose
})

afterAll(() => dispose())

async function run(spec: StreamSpec): Promise<StreamReport> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP, documentPath, 'reduce', 'fine')
  return page.raw.evaluate(
    (s) =>
      (window as unknown as { aiPart: { run: (spec: unknown) => Promise<unknown> } }).aiPart.run(s),
    spec,
  ) as Promise<StreamReport>
}

const complete = (report: StreamReport, why: string): void => {
  expect(report.text.length, `${why}: characters kept`).toBe(TEXT_LENGTH)
  expect(report.status, why).toBe('ready')
  expect(report.error, why).toBeUndefined()
  expect(report.messageCount, why).toBe(2)
  expect(report.aborted, `${why}: client aborts`).toBe(0)
}

layout('P3: the component-owned Chat recipe (gap-perf S1-S9)', () => {
  test('S1 StrictMode send: 86 of 86 characters, one assistant message', async () => {
    complete(await run({ strict: true }), 'S1')
  })

  test('S2 StrictMode + resume, page opened mid-stream: replayed once, no duplicated text', async () => {
    const report = await run({ strict: true, resume: true })
    expect(report.text.length).toBe(TEXT_LENGTH)
    expect(report.status).toBe('ready')
    // The replay carries the assistant message alone; the user turn is the loader's (P3b).
    expect(report.messageCount).toBe(1)
    expect(report.gets).toBeGreaterThanOrEqual(1)
  })

  test('S3 + S4 + S9: hidden by <Activity> mid-stream, the owned Chat never cancels (StrictMode too)', async () => {
    for (const strict of [false, true]) {
      const report = await run({ strict, activity: { hideAt: 300, showAt: 600 } })
      complete(report, `Activity, strict ${strict}`)
    }
  })

  test('S3 control: useChat() with no chat loses the stream to <Activity> without an error', async () => {
    const report = await run({ internal: true, activity: { hideAt: 300, showAt: 600 } })
    expect(report.text.length).toBeLessThan(TEXT_LENGTH)
    expect(report.status).toBe('ready')
    expect(report.error).toBeUndefined()
    expect(report.aborted).toBeGreaterThanOrEqual(1)
  })

  test('S5b genuine unmount mid-stream: the owned Chat is not cancelled, the run finishes', async () => {
    const report = await run({ unmountAt: 300 })
    expect(report.aborted).toBe(0)
    expect(report.completed).toBe(1)
  })

  test('S6 error chunk at delta 10: status error, the message, the partial text kept', async () => {
    const report = await run({ failAt: 9 })
    expect(report.status).toBe('error')
    expect(report.error).toBe('boom')
    expect(report.text.length).toBe(9 * 4)
  })

  test('S7 renders per delta: a 100 ms throttle cuts the commits', async () => {
    const free = await run({ throttle: 0 })
    const throttled = await run({ throttle: 100 })
    expect(free.commits).toBeGreaterThanOrEqual(DELTA_COUNT)
    expect(throttled.commits).toBeLessThanOrEqual(DELTA_COUNT / 2)
    expect(throttled.text.length).toBe(TEXT_LENGTH)
  })

  test('S8 no crypto.randomUUID: ids are still generated and distinct', async () => {
    const report = await run({ strict: true, noUuid: true })
    complete(report, 'S8')
    expect(report.ids.every((id) => id.length > 0)).toBe(true)
    expect(new Set(report.ids).size).toBe(report.ids.length)
  })
})

layout('S10: a streaming partView that is not on screen keeps every character', () => {
  test('under CSS display:none: 86 of 86, nothing visible', async () => {
    const report = await run({ container: 'css-hide' })
    complete(report, 'css-hide')
    expect(report.chars).toEqual([TEXT_LENGTH])
    expect(report.invisible).toBe(true)
  })

  test('under ui/collapsible with keepMounted, closed: 86 of 86 in the DOM, nothing visible', async () => {
    const report = await run({ container: 'collapsible-keep' })
    complete(report, 'collapsible keepMounted')
    expect(report.chars).toEqual([TEXT_LENGTH])
    expect(report.invisible).toBe(true)
  })

  test('under ui/collapsible unmounted while closed: the Chat holds 86 and opening shows 86', async () => {
    const report = await run({ container: 'collapsible', openAfter: true })
    complete(report, 'collapsible')
    expect(report.chars).toEqual([])
    expect(report.charsOpened).toEqual([TEXT_LENGTH])
  })
})
