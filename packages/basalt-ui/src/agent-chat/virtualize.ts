/**
 * Virtualization contract shared by the transcript/feed components that can opt into
 * `@tanstack/react-virtual` for long lists.
 *
 * The `VirtualizeProps` union IS the guard: a virtualizer needs a measured scroll container, so
 * turning `virtualize` on REQUIRES a `height` and turning it off (or omitting it) FORBIDS one. See
 * `virtualize.type-guard.test.ts` beside this file for a compile-time proof that the union actually
 * rejects the invalid combinations.
 *
 * The one piece of runtime here is {@link resolveVirtualize} — the single narrowing point every
 * component that accepts `VirtualizeProps` goes through, so no call site has to re-derive (or
 * assert its way past) the union's `virtualize`-implies-`height` link.
 *
 * The other half of the contract, not encoded in the types (it's a runtime/composition rule, not
 * a shape): a virtualized transcript OWNS ITS OWN SCROLL NODE (the element `getScrollElement`
 * measures) and must NOT be nested inside `BasaltStickToBottom` — unlike the non-virtual path,
 * which `ThreadDetailPanel` nests inside `BasaltStickToBottom` today (its transcript body).
 * Stacking a virtualizer's own scroll container inside `BasaltStickToBottom`'s would give the
 * transcript two competing owners of "which element scrolls" and break both the virtualizer's
 * `scrollToEnd` and stick-to-bottom's anchor tracking.
 *
 * A third composition rule, same category (runtime, not a shape): a virtualized transcript
 * tolerates being hidden via `display: none` on an ANCESTOR (e.g. sitting inside a collapsible
 * `ThreadFeedRow`) — collapsing does not corrupt its measurement cache, and re-expanding restores
 * the same scroll position (same top-visible row) it had before the collapse. This is NOT free of
 * virtual-core: hiding an ancestor makes every mounted row's ResizeObserver box report `0` (a
 * `display: none` ancestor un-lays-out its descendants), and virtual-core 3.17.1's default
 * `measureElement`/`resizeItem` write that `0` into `itemSizeCache` with no floor — unguarded, a
 * few collapse/expand cycles permanently shrink `getTotalSize()` and silently scroll the visible
 * window to a DIFFERENT part of the transcript (`scrollTop` stays put; the content under it moves).
 * `thread-message.tsx` closes this with a `measureElement` override (`resolveGuardedMeasurement`)
 * that treats a `0` reading as unreliable and keeps the last-known size instead of committing it —
 * see that function's doc for the full mechanism, including why `useVirtualizer`'s `enabled` option
 * is NOT the fix (it wipes the measurement cache outright, worse than the bug). A consumer combining a
 * virtualized transcript with its own hide-via-CSS container gets this for free; a consumer who
 * unmounts/remounts the transcript instead of hiding it is unaffected either way (a fresh
 * `useVirtualizer` call has no stale cache to poison).
 *
 * A fourth composition rule: a virtualized transcript SCROLLS ITSELF on mount. `initialScroll`
 * defaults to `'end'` — `anchorTo: 'end'` and `followOnAppend` (both wired in `thread-message.tsx`)
 * only keep an ALREADY-at-the-end transcript pinned as content changes; neither performs the initial
 * jump, so left alone a freshly mounted virtualized transcript renders at message #0, not the
 * newest. The fix fires exactly once, on first mount, via `scrollToEnd()` — never again, so a user
 * who has scrolled up is never yanked back down by a later append (that is precisely the failure
 * `followOnAppend` exists to avoid, and re-introducing it here would be worse than the defect this
 * closes). A consumer wiring its OWN scroll-restoration (e.g. `initialOffset` /
 * `initialMeasurementsCache`, restoring a prior session's position) wants `initialScroll: 'start'` —
 * otherwise this default jump fires first and the restoration has to fight it. `initialScroll` is
 * ignored (no scroll, no throw) for an empty transcript, and is deferred rather than treated as done
 * if the transcript's own scroll container measures 0px on mount (e.g. mounted behind a hidden
 * ancestor) — it then lands on the first commit where the container is genuinely measurable, which
 * is what makes "opens at the newest message" hold for a transcript whose lazy virtualizer settled
 * while its `ThreadFeedRow` was collapsed. See `thread-message.tsx`'s `applyInitialScroll` for the
 * guard, and `VirtualizedRowsInner` for why its effect is deliberately dependency-free.
 *
 * Firing `scrollToEnd()` once is not sufficient on its own to land there, because virtual-core
 * 3.17.1's own `_willUpdate` writes to the SAME scroll container on the very next commit it runs
 * on, from state that lags behind the DOM: `_scrollToOffset` only ever records the write's
 * intent (`_intendedScrollOffset`) — `this.scrollOffset` itself updates ASYNCHRONOUSLY, from the
 * native `scroll` event, not from the call that requested it. So a commit that runs `_willUpdate`
 * before this effect had a chance to fire (element-attach) or that re-derives an anchor from
 * `getScrollOffset()` while `this.scrollOffset` is still the pre-jump value (the anchor branch,
 * gated on `pendingScrollAnchor`) writes that stale offset — 0, on first mount — straight back to
 * `scrollTop`, clobbering this effect's jump within roughly one extra commit of it landing.
 * `applyInitialScroll` survives this the same way the hidden-ancestor case above already
 * (accidentally) does: by not treating one successful call as permanent. It fires, then — on a
 * LATER call, i.e. a later commit, exactly the cadence this dependency-free effect already runs on
 * — reads the container's REAL `scrollTop`/`scrollHeight`/`clientHeight` (never virtual-core's own
 * `scrollOffset`, which is exactly the stale value that caused the clobber) to check whether the
 * jump survived; if it didn't, it re-fires, bounded by `MAX_INITIAL_SCROLL_ATTEMPTS` so a DOM that
 * pathologically never reports settled can never be fought forever. `resolveInitialScrollAction`
 * itself is untouched by any of this — it is still the one-shot "should I even attempt this"
 * decision; `applyInitialScroll` layers the across-commits verification on top.
 *
 * `initialOffset` (`number | (() => number)`, `virtual-core`'s own construction-time seed for
 * `scrollOffset`) was investigated as a way to avoid the clobber altogether and rejected: it takes
 * a concrete pixel number, not an `'end'` sentinel, and the only number available at the point
 * it would need to resolve — before any row has ever been measured — is an ESTIMATE
 * (`estimateSize` × count), not the real total. It would relocate the transcript's initial paint
 * from message #0 to an approximately-right position, but the moment real measurements replace
 * those estimates the total size (and therefore the true end offset) changes, which still needs a
 * corrective `scrollToEnd()` once rows have actually measured — the exact write this whole
 * mechanism exists to protect. It also can't reference the `virtualizer` instance it would be
 * computing an offset for without a separate ref indirection, since it is itself one of the options
 * passed to construct that instance. Not a fix for this defect, just a smaller wrong first paint.
 */

/** Tuning knobs passed through to `@tanstack/react-virtual`'s `useVirtualizer`. */
export type VirtualizeOptions = {
  /** Extra rows rendered beyond the visible viewport, each side. Library default: 1. */
  readonly overscan?: number
  /** Estimated row height in px, used before a row has been measured. */
  readonly estimateSize?: number
  /** Where the transcript sits on first mount. Default 'end' — a chat transcript opens at the
      newest message. 'start' opens at the oldest. See this module's fourth composition rule
      above for the mechanism and why a consumer restoring its own scroll position wants 'start'. */
  readonly initialScroll?: 'end' | 'start'
}

/**
 * `virtualize: false` (or omitted) → no `height` prop (content-sized, non-scrolling-owner layout).
 * `virtualize: true | VirtualizeOptions` → `height` is REQUIRED — the virtualizer measures a fixed
 * scroll container, so there is no valid virtualized layout without one.
 */
export type VirtualizeProps =
  | { readonly virtualize?: false; readonly height?: never }
  | { readonly virtualize: true | VirtualizeOptions; readonly height: number | string }

/** The enabled branch of {@link VirtualizeProps}, with `height` no longer optional. */
export type ResolvedVirtualize = {
  readonly options: VirtualizeOptions
  readonly height: number | string
}

/**
 * Narrows a `VirtualizeProps` pair once, centrally: `null` when virtualization is off, otherwise
 * the options object (normalizing the bare `virtualize: true` shorthand to `{}`) alongside the
 * `height` the union guarantees is present. Every component accepting `VirtualizeProps` resolves
 * through here rather than destructuring the two fields apart — destructuring severs the link TS
 * needs, which is what forces a non-null assertion on `height` at each call site.
 */
export function resolveVirtualize(props: VirtualizeProps): ResolvedVirtualize | null {
  const { virtualize } = props
  if (virtualize === undefined || virtualize === false) return null
  // The union already REQUIRES `height` on this branch and rejects it on the other — that guarantee
  // is enforced where it matters, at every call site (see virtualize.type-guard.test.ts). What TS
  // won't do is propagate the narrowing FROM `virtualize` TO `height`: `virtualize`'s enabled branch
  // is `true | VirtualizeOptions`, and the object constituent disqualifies it as a discriminant
  // property. So the pairing is re-stated once, here, instead of a `height!` at each consumer.
  const height = props.height as number | string
  return { options: virtualize === true ? {} : virtualize, height }
}
