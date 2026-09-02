/**
 * Layout invariants for `basalt-ui/agent-chat`'s virtualized transcript — the ones happy-dom
 * cannot observe at all, because `@tanstack/react-virtual`'s `measureElement` and
 * `ResizeObserver`-driven remeasure have no meaning without a real layout engine.
 *
 * Absorbed from three retired playground routes (audit E §7, consolidation plan C3):
 * `/agent-transcript-virtualize` (a windowed transcript actually scrolls and windows real DOM
 * rows), `/agent-inline-feed-virtualized` (a virtualized transcript nested inside a collapsed→
 * expandable `ThreadFeedRow` recovers its measurement after a `display: none` cycle), and
 * `/agent-anchor-to-end` (`anchorTo: 'end'` + `followOnAppend` stays pinned to a live turn's tail
 * against a real scroll, and stops once the reader scrolls away past the threshold).
 */
import { afterAll, describe, test } from 'bun:test'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  expectHeightAtMost,
  expectScrolls,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { FixtureSpec } from './fixture/spec'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SCROLL = '.lyt-agent-scroll'
const ROW_BODY = '[data-testid="thread-feed-row-body"]'
const ROW_SCROLL = `${ROW_BODY} [style*="overflow: auto"]`
const HEIGHT = 320

type ScrollGeometry = { scrollTop: number; scrollHeight: number; clientHeight: number }

async function readScrollGeometry(
  p: Awaited<ReturnType<typeof openFixture>>,
  selector: string,
): Promise<ScrollGeometry> {
  const geometry = await p.raw.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
  }, selector)
  if (!geometry) {
    throw new Error(
      `LAYOUT: no element matched \`${selector}\` — the transcript did not render it.`,
    )
  }
  return geometry
}

layout('agent-chat transcript — real layout', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /**
   * INVARIANT 1 — a windowed transcript actually windows: the scroll node is genuinely
   * scrollable, and scrolling it moves which `data-index` rows are in the DOM. happy-dom cannot
   * see `measureElement` run at all, so a broken row-height measurement (every row collapsing to
   * its estimate, or the virtualizer never mounting) has never been observed before this file.
   */
  test('a windowed transcript scrolls and its rendered rows change under scroll', async () => {
    const spec: FixtureSpec = {
      sections: [
        { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
      ],
      agent: { messages: 200, height: HEIGHT, mode: 'virtualized' },
    }
    const p = await openFixture(spec, PHONE)
    // The real virtualizer is behind a one-tick `Suspense` (`@tanstack/react-virtual` resolves as
    // a dynamic import) — its fallback is an EMPTY, correctly-sized scroll pane with the same
    // `overflow: auto` shape, so reading geometry before a `[data-index]` row lands would measure
    // the placeholder instead and read `scrollHeight === clientHeight` vacuously.
    await p.waitFor(`${SCROLL} [data-index]`)

    const wrapper = await p.box('transcript scroll node', SCROLL)
    expectHeightAtMost(
      wrapper,
      HEIGHT + 1,
      'the virtualized scroll node honours the fixed height it was given',
    )

    const info = await p.scroll(SCROLL)
    expectScrolls(
      'transcript',
      info,
      '200 non-uniform-height messages in a 320px window must overflow, or windowing is not ' +
        'actually engaged and every assertion below is vacuous',
    )

    // `VirtualizeOptions.initialScroll` defaults to `'end'` (1.13.0), so the fixture already
    // mounts scrolled to the tail — force it to the TOP first, or "before" would already be the
    // same rows "after" scrolling to the end and the comparison below would be vacuous.
    await p.raw.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (el) el.scrollTop = 0
    }, SCROLL)
    await p.settle()
    const before = await p.raw.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll(`${sel} [data-index]`)).map((el) =>
          el.getAttribute('data-index'),
        ),
      SCROLL,
    )
    await p.raw.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (el) el.scrollTop = el.scrollHeight - el.clientHeight
    }, SCROLL)
    await p.settle()
    const after = await p.raw.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll(`${sel} [data-index]`)).map((el) =>
          el.getAttribute('data-index'),
        ),
      SCROLL,
    )

    if (before.length === 0 || after.length === 0) {
      throw new Error('LAYOUT INVARIANT VIOLATED — the virtualizer rendered no row at all.')
    }
    if (before.join(',') === after.join(',')) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — scrolling to the end rendered the exact same rows as the ' +
          `top: ${before.join(',')}. Windowing is not moving with the scroll position.`,
      )
    }
  })

  /**
   * INVARIANT 2 — a virtualized transcript nested inside a collapsed `ThreadFeedRow` recovers a
   * real scrollable measurement after a `display: none` round trip. This is the exact case the
   * defect this fixture stands in for: a scroll node measures 0 height while hidden, and whether
   * it comes back depends on a `ResizeObserver` firing on the display toggle — real in a browser,
   * absent from happy-dom.
   */
  test('an inline-row transcript recovers a scrollable measurement after collapse + re-expand', async () => {
    const spec: FixtureSpec = {
      sections: [
        { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
      ],
      agent: { messages: 150, height: HEIGHT, mode: 'inlineRow' },
    }
    const p = await openFixture(spec, PHONE)

    // Not yet opened: the row is lazy-mount, so its body has never rendered at all.
    if (await p.count(ROW_BODY)) {
      throw new Error('LAYOUT INVARIANT VIOLATED — the row body rendered before its first expand.')
    }

    await p.tap('[data-testid="agent-row-toggle"]')
    // `ROW_SCROLL` alone matches the one-tick Suspense fallback too (same `overflow: auto` shape,
    // empty) — wait for a real rendered row before reading geometry.
    await p.waitFor(`${ROW_BODY} [data-index]`)
    const firstOpen = await readScrollGeometry(p, ROW_SCROLL)
    if (!(firstOpen.scrollHeight > firstOpen.clientHeight)) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — the first expand did not produce a real scrollable ' +
          `transcript (scrollHeight ${firstOpen.scrollHeight} vs clientHeight ${firstOpen.clientHeight}).`,
      )
    }

    // Collapse — the row stays MOUNTED (kept-mounted invariant), only its display flips.
    await p.tap('[data-testid="agent-row-toggle"]')
    await p.settle()
    const display = await p.computed(ROW_BODY, 'display')
    if (display !== 'none') {
      throw new Error(
        `LAYOUT INVARIANT VIOLATED — a collapsed row body must be \`display: none\`, got \`${display}\`.`,
      )
    }
    if (!(await p.count(ROW_SCROLL))) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — the transcript unmounted on collapse instead of staying ' +
          'mounted and merely hidden.',
      )
    }

    // Re-expand — the scroll node must recover its real geometry, not stay stuck at its poisoned
    // zero from the display:none read.
    await p.tap('[data-testid="agent-row-toggle"]')
    await p.settle()
    const reopened = await readScrollGeometry(p, ROW_SCROLL)
    if (!(reopened.clientHeight > 0 && reopened.scrollHeight > reopened.clientHeight)) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — re-expanding after a display:none cycle left the ' +
          `transcript unmeasured (scrollHeight ${reopened.scrollHeight}, clientHeight ${reopened.clientHeight}).`,
      )
    }
  })

  /**
   * INVARIANT 3 — `anchorTo: 'end'` + `followOnAppend` tracks a live turn's tail against a real
   * scroll, and stops the instant the reader scrolls away past the threshold — then resumes once
   * they scroll back near the bottom. `scrollEndThreshold` is internal (64px, `thread-message.tsx`)
   * and not asserted directly; only the OBSERVABLE behaviour it drives is.
   */
  test('a live turn stays pinned to the bottom while streaming, holds once scrolled away, resumes near the bottom', async () => {
    const spec: FixtureSpec = {
      sections: [
        { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
      ],
      agent: { messages: 5, height: 240, mode: 'anchorToEnd' },
    }
    const p = await openFixture(spec, PHONE)
    await p.waitFor(`${SCROLL} [data-index]`)

    await p.tap('[data-testid="agent-start-stream"]')
    await p.raw.waitForTimeout(150)

    const pinned = await readScrollGeometry(p, SCROLL)
    const maxScroll = pinned.scrollHeight - pinned.clientHeight
    if (!(maxScroll - pinned.scrollTop <= 64)) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — a streaming turn must stay pinned within the follow ' +
          `threshold of the bottom; distance from bottom = ${maxScroll - pinned.scrollTop}px.`,
      )
    }

    // Scroll away, well past the threshold, while the stream is still running.
    await p.raw.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (el) el.scrollTop = 0
    }, SCROLL)
    await p.settle()
    await p.raw.waitForTimeout(300)

    const held = await readScrollGeometry(p, SCROLL)
    if (held.scrollTop > 20) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — followOnAppend must stop re-anchoring once the reader ' +
          `scrolled away from the tail; scrollTop drifted back to ${held.scrollTop}px.`,
      )
    }

    // Scroll back near the bottom (inside the threshold) and let the remaining stream land.
    await p.raw.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (el) el.scrollTop = el.scrollHeight - el.clientHeight - 10
    }, SCROLL)
    await p.settle()
    await p.raw.waitForTimeout(2000)

    const resumed = await readScrollGeometry(p, SCROLL)
    const resumedMax = resumed.scrollHeight - resumed.clientHeight
    if (!(resumedMax - resumed.scrollTop <= 64)) {
      throw new Error(
        'LAYOUT INVARIANT VIOLATED — following must resume once the reader returns near the ' +
          `bottom; distance from bottom after resuming = ${resumedMax - resumed.scrollTop}px.`,
      )
    }
  })
})
