/**
 * Evidence lane: the OTel trace of one chat turn end to end. Drives the playground's `/agent` Stream
 * tab with an in-process OTLP receiver attached (build MUST use `VITE_TELEMETRY=1`, as for `otel`):
 *
 *  - ok turn: load `/`, click through to `/agent` (so `route.navigate` precedes), open Stream, send
 *    one message, wait for the reply to finish → expect `route.navigate` then `chat.turn` (ok).
 *  - failed turn: load `/agent?fail=1` (the demo's transport streams 3 parts then throws a 500-style
 *    error), open Stream, send → expect `chat.turn` with `failed`, `exception.type` and
 *    `basalt.error.kind`.
 *
 * The raw span attributes go to the detail JSON; the summary carries the headline numbers.
 */
import { startOtelReceiver } from './otel-receiver'
import type { CollectedSpan } from './otel-receiver'
import { VIEWPORT } from './perf-util'
import type { Lane } from './types'

const PROMPT = 'How do deep modules reduce coupling?'
const TYPING = '[aria-label="Assistant is typing"]'
const COMPOSER = 'textarea[placeholder^="Send a message"]'
const SPAN_TIMEOUT_MS = 30_000

/** The `chat.turn` spans of a run, in arrival order, split by outcome. Pure — the unit test pins it. */
export function chatTurns(spans: readonly CollectedSpan[]): {
  ok: CollectedSpan[]
  failed: CollectedSpan[]
} {
  const turns = spans.filter((s) => s.name === 'chat.turn')
  return { ok: turns.filter((s) => !s.failed), failed: turns.filter((s) => s.failed) }
}

/** Spans as the detail JSON records them: start relative to the first span, no absolute clock. */
export function relative(spans: readonly CollectedSpan[]) {
  const t0 = Math.min(...spans.map((s) => s.start))
  return spans.map((s) => ({
    name: s.name,
    startMs: Math.round(s.start - t0),
    durationMs: Math.round(s.duration * 10) / 10,
    failed: s.failed,
    attributes: s.attributes,
  }))
}

async function waitFor(what: string, until: () => boolean): Promise<void> {
  const deadline = Date.now() + SPAN_TIMEOUT_MS
  while (!until()) {
    if (Date.now() > deadline) throw new Error(`chat-turn-trace: timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

export const chatTurnTrace: Lane = async (ctx) => {
  const browser = await ctx.openBrowser()
  const receiver = startOtelReceiver()
  const record = async (run: 'ok' | 'fail') => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
    await context.addInitScript((url) => {
      Object.assign(window, { __BASALT_OTLP__: url })
    }, receiver.url)
    const page = await context.newPage()
    const before = receiver.spans().length
    try {
      if (run === 'ok') {
        await page.goto(ctx.baseUrl, { waitUntil: 'networkidle' })
        await page.locator('a[href="/agent"]:visible').first().click()
        await page.waitForURL((u) => u.pathname === '/agent')
      } else {
        await page.goto(`${ctx.baseUrl}/agent?fail=1`, { waitUntil: 'networkidle' })
      }
      await page.getByRole('tab', { name: 'Stream' }).click()
      await page.waitForSelector(COMPOSER)
      await page.fill(COMPOSER, PROMPT)
      await page.press(COMPOSER, 'Enter')
      await page.waitForSelector(TYPING, { state: 'attached' })
      if (run === 'ok') await page.waitForSelector(TYPING, { state: 'detached' })
      await waitFor(`${run} chat.turn`, () =>
        receiver.spans().some((s, i) => i >= before && s.name === 'chat.turn'),
      )
      // Batch processor flushes every 300 ms.
      await page.waitForTimeout(1000)
    } finally {
      await context.close()
    }
    return receiver.spans().slice(before)
  }
  try {
    const okSpans = await record('ok')
    const failSpans = await record('fail')
    const ok = chatTurns(okSpans).ok[0]
    const failed = chatTurns(failSpans).failed[0]
    if (!ok) throw new Error('chat-turn-trace: no ok chat.turn span')
    if (!failed) throw new Error('chat-turn-trace: no failed chat.turn span')
    return {
      lane: 'chat-turn-trace',
      summary: [
        {
          metric: 'chat.turn ok: ttft',
          value: Number(ok.attributes['basalt.chat.ttft_ms']),
          unit: 'ms',
        },
        { metric: 'chat.turn ok: duration', value: Math.round(ok.duration), unit: 'ms' },
        { metric: 'chat.turn ok: parts', value: Number(ok.attributes['basalt.chat.parts']) },
        { metric: 'chat.turn ok: status', value: String(ok.attributes['basalt.chat.status']) },
        {
          metric: 'route.navigate before chat.turn (ok run)',
          value: okSpans.some((s) => s.name === 'route.navigate' && s.start <= ok.start) ? 1 : 0,
        },
        {
          metric: 'chat.turn failed: basalt.error.kind',
          value: String(failed.attributes['basalt.error.kind']),
        },
        {
          metric: 'chat.turn failed: exception.type',
          value: String(failed.attributes['exception.type']),
        },
        {
          metric: 'chat.turn failed: status',
          value: String(failed.attributes['basalt.chat.status']),
        },
      ],
      detail: { failRun: relative(failSpans), okRun: relative(okSpans) },
    }
  } finally {
    receiver.stop()
  }
}
