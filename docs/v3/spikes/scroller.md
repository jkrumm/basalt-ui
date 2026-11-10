# Spike: scroll pinning for streamed chat (P12)

Neither package sticks. `use-stick-to-bottom` loses its lock for good when the soft keyboard closes, and `message-scroller` runs one line behind the stream. A 39-line own hook, measured through the same fixture, sticks on every line. The code is under Verdict.

Harness: `bun tools/spikes/scroller/run.ts` (one JSON object on stdout, exit 0; about 5 minutes, Chrome required). Concept: `docs/v3/concepts/ai-mdx.md` section 7, P12. The 2.x reference `packages/basalt-ui/src/agent/stick-to-bottom.tsx` was read, not changed.

## Question

Which scroll-pinning dependency does the v3 chat-thread recipe take for a streamed reply: `use-stick-to-bottom` 1.1.6 or `@shadcn/react/message-scroller` 0.3.1? If neither survives a 90 s stream, a short own hook replaces both and the recipe carries no scroll dependency. The loser stays out of every lockfile.

## Method

**Fixture.** One page, `fixture/app.tsx`, for both candidates. A 390x844 viewport with a header, a scroll element and a composer. Five seeded history messages, one of them holding an `<img>` whose `src` is unset (height 0). One assistant message grows for 90 s: every 100 ms one or two synthetic words, in a repeating plan of heading, paragraph, list, paragraph, code block (about 1,350 words, 5 cycles). The candidate supplies only `Scroller` and `Item` (`candidates/*.tsx`), on its defaults and with `autoScroll` for `message-scroller`.

**Browser.** The `chrome` channel via `playwright-core` 1.63.0, as the layout harness does, desktop Chrome at the mobile width. Scroll input is `mouse.wheel`. The pixel gap is `scrollHeight - scrollTop - clientHeight` of the scroll element, sampled once a second for 90 s.

**Timeline, fixed before measuring.**

| t    | Event                                                                      | Metric                                                                                         |
| ---- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1-90 | stream, sample every 1 s                                                   | `maxGapPx`: max of the samples taken while pinned (outside the four event windows below)       |
| 20   | wheel up 700 px                                                            | `releasedOnScrollUp`: `scrollTop` moves <= 2 px over the next 3 s and the gap stays above 8 px |
| 24   | wheel down to 6 px above the bottom                                        | `repinnedOnReturn`: gap <= 8 px right after, and <= 2 px 1 s later                             |
| 40   | the image above the bottom gets its `src`, the server answers after 400 ms | `reflowGapPx`: gap 1 s after `onload` (height 0 to about 220 px, stream still running)         |
| 60   | viewport 390x844 to 390x484 (soft-keyboard model)                          | `keyboardGapPx`: gap 1 s later                                                                 |
| 70   | viewport back to 390x844                                                   | sampled only inside `maxGapPx`'s exclusion window                                              |

Event windows excluded from `maxGapPx` run from the event to 600 ms after its metric sample (release and return 20 s to the return sample; reflow; keyboard open; keyboard close 1.6 s). Samples inside them are not hidden: they are in `detail.gapSamples`.

**`sticks`** is `maxGapPx <= 2`, `releasedOnScrollUp`, `repinnedOnReturn`, `reflowGapPx <= 2` and `keyboardGapPx <= 2`, all five. **`gzipBytes`** is the gzip (level 9) of a minified `Bun.build` of the candidate's adapter with `react` external. Both sticking would have picked the smaller; neither did.

**Third candidate.** Because the fallback is code in this document, `candidates/own-hook.tsx` runs through the same fixture. It does not gate the choice between the two packages; it shows the fallback holds the law the packages were held to.

## Measurements

Two full runs, Chrome 157.0.8103.40. Raw output: `tools/spikes/scroller/results/run-1.json` and `run-2.json`, with `detail.gapSamples` (90 values each).

| Candidate (run)           | maxGapPx | releasedOnScrollUp | repinnedOnReturn | reflowGapPx | keyboardGapPx | gzipBytes | sticks |
| ------------------------- | -------- | ------------------ | ---------------- | ----------- | ------------- | --------- | ------ |
| `use-stick-to-bottom` (1) | 1203     | true               | false            | 5           | 25            | 2197      | false  |
| `use-stick-to-bottom` (2) | 1203     | true               | false            | 26          | 24            | 2197      | false  |
| `message-scroller` (1)    | 31       | true               | true             | 0           | 23            | 6415      | false  |
| `message-scroller` (2)    | 34       | true               | true             | 0           | 23            | 6415      | false  |
| `own-hook` (1)            | 0        | true               | true             | 0           | 0             | 541       | true   |
| `own-hook` (2)            | 0        | true               | true             | 0           | 0             | 541       | true   |

What the numbers are:

- **`use-stick-to-bottom`, lock lost at keyboard close.** At 70 s the viewport grows back and the gap goes 0, 66, 111, 156, 201 and on to 1203 at 90 s: it never re-pins, the stream just runs away from the user. Both runs, same seconds. Before that, 52 of 63 pinned samples in run 1 and 51 of 63 in run 2 are above 2 px, up to 37 and 41 px (its default spring), so `maxGapPx` fails on lag as well, and `repinnedOnReturn` fails on the spring: 3 px one second after the return in both runs, against the 2 px bar. `reflowGapPx` is 5 in run 1 and 26 in run 2: it depends on where the spring is.
- **`message-scroller`, one line behind.** 18 of 75 pinned samples in run 1 and 14 of 75 in run 2 are above 2 px, almost all 19 to 34 px, a single line at 22.5 px line height; the rest are 0. Release, return and reflow are clean (0, 0). By its source (`dist/message-scroller/index.js`) the lag is structural: its `ResizeObserver` hands the work to a `requestAnimationFrame`, so the grown line can be painted one frame before the scroll catches up. A one-line jump several times during a stream, not a sampling artefact; a paint-level capture was not taken. `keyboardGapPx` is 23: the same line, caught right after the shrink.
- **`own-hook`.** 0 at every pinned sample; the four non-zero samples are the release window (745 to 1000 px while the user is scrolled up, as designed).
- **`reflowPeakGapPx` and `keyboardPeakGapPx`** in `detail` are an in-page `requestAnimationFrame` maximum. `requestAnimationFrame` runs before `ResizeObserver` callbacks in a frame, so for a follower that corrects inside its observer (`own-hook`: 221 and 360) the peak is a pre-correction state that is never painted. They are not used in the verdict.

## Verdict

Choice: own-hook

Both packages fail the law in `ai-mdx.md` P12 on measured numbers, in two identical runs: `use-stick-to-bottom` on `maxGapPx` (1203), `repinnedOnReturn` and `keyboardGapPx`; `message-scroller` on `maxGapPx` (31, 34) and `keyboardGapPx` (23). The recipe carries this hook instead. 39 code lines, imports included, no dependency, 541 bytes gzip (react external).

```tsx
import { useCallback, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

const PIN_PX = 8

/** Pin a scroll element to its bottom while content grows; release on scroll-up, re-pin within 8 px. */
export function useStickToBottom(): {
  scrollRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  pinned: RefObject<boolean>
} {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const lastTop = useRef(0)

  const follow = useCallback(() => {
    const el = scrollRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight - el.clientHeight
  }, [])

  // Every commit of the owner: the DOM has grown, scroll before the browser can paint.
  useLayoutEffect(follow)

  // Reflow React did not cause (a late image, the soft keyboard): same frame, before paint.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    const observer = new ResizeObserver(follow)
    observer.observe(el)
    observer.observe(content)
    const onScroll = (): void => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight
      if (gap <= PIN_PX) pinned.current = true
      else if (el.scrollTop < lastTop.current) pinned.current = false
      lastTop.current = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [follow])

  return { scrollRef, contentRef, pinned }
}
```

Rules the hook relies on, and the recipe must keep:

- Call it in a component that re-renders when the stream does. The no-deps `useLayoutEffect` scrolls in the same task as the React commit, so no sample (and no paint) sees the grown content unscrolled. The `ResizeObserver` covers reflow React did not cause (a late image, the keyboard) and corrects before paint.
- The scroll element sets `overflow-anchor: none`, so the browser's own anchoring does not move `scrollTop` under the hook.
- Release is "`scrollTop` went down and the gap is above 8 px"; re-pin is "gap within 8 px". A user nudge of 8 px or less up is a re-pin, as in `message-scroller`.

Limits of this verdict:

- The packages ran on their defaults. `use-stick-to-bottom` exposes `resize`, `damping`, `mass` and `stiffness`; an `instant` resize would likely remove its lag, but not the lock lost at keyboard close, which nothing in its API addresses. Not measured, so not claimed.
- Real iOS is not tested. The keyboard is a viewport-resize model; iOS shrinks the visual viewport, not the layout viewport. Touch scrolling, Safari and rubber-banding are untested: user input is `mouse.wheel`.
- Chrome 157 only, 390 px wide, one synthetic stream. VoiceOver on streaming is out of scope.
- The hook was measured by the harness that picked it. It is a fallback that satisfies the same law, not an independent review.

## Then

- **I8 (`chat-thread` recipe, thread fixture, P12 closed).** The recipe ships the hook above as `src/components/chat/use-stick-to-bottom.ts` (or inline in the thread), and the layout test for the thread fixture drives the same timeline: a stream, a wheel up, a return, a late image, a viewport shrink to 484 px, with the same bars.
- **Dependencies.** The recipe takes no scroll dependency. `use-stick-to-bottom` and `@shadcn/react` go in no v3 `package.json` or lockfile. `use-stick-to-bottom` stays in the root `bun.lock` and `packages/basalt-ui/package.json` only as the 2.x agent module's optional peer; it leaves with that module.
- **Concept table.** Section 2 row 13 and the P12 row (`ai-mdx.md`) change to name the own hook. This spike does not touch `docs/v3/concepts/**`; that edit belongs to whoever owns the concept.

## Affects

- `docs/v3/concepts/ai-mdx.md`: section 2 row 13 (`use-stick-to-bottom` or `message-scroller`, picked by P12), section 7 P12 (gate closed), and the I8 line in the factory chain.
- `ai-i8` (chat-thread recipe, thread fixture, P12), which this feeds.
- The `one-look` and layout-suite thread fixture: they add the timeline above.
- Nothing else: no `package.json` and no lockfile outside `tools/spikes/scroller/package.json`.
