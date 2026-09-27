import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useIsomorphicLayoutEffect } from './isomorphic-layout-effect'

/** One measured element's box, cached while it was still visible (a folded child is gone from the DOM). */
export type MeasuredBox = { width: number; height: number }

export interface UseMeasuredWidthsOptions {
  /** The box to observe, resolved on each effect run. */
  resolveRoot: () => HTMLElement | null
  /** Change this string to drop every cached box — a folded child cannot report its unfolded width. */
  signature: string
  /** Skip measuring entirely (the feature is off). Default true. */
  enabled?: boolean
  /** Bump to re-measure on demand beyond a resize (a post-reset commit). */
  nonce?: number
  /** Extra descendants to observe besides the root (an inner table whose min-content can move). */
  extra?: (root: HTMLElement) => (Element | null)[]
  /** Read the current boxes from `root`, fill the cache, and plan — runs on every measure. */
  onMeasure: (root: HTMLElement, boxes: MutableRefObject<Map<string, MeasuredBox>>) => void
}

export interface UseMeasuredWidthsResult {
  boxes: MutableRefObject<Map<string, MeasuredBox>>
  /** Re-run the measurement by hand (a web font settling changes every width without a resize). */
  remeasure: () => void
}

/**
 * The measured-fold core every fold planner shares: caches each measured box while it is visible,
 * re-reads on a `ResizeObserver` of the root (plus {@link UseMeasuredWidthsOptions.extra}), and
 * clears the cache when the {@link UseMeasuredWidthsOptions.signature} changes. The caller keeps its
 * own element reading and pure plan function in `onMeasure`.
 *
 * A folded child is gone from the DOM but its cached box survives, so a resize never needs it back
 * on screen; the caller's `onMeasure` decides which boxes to cache (e.g. skip an item that is
 * currently folded, whose painted width is the collapsed one).
 */
export function useMeasuredWidths(options: UseMeasuredWidthsOptions): UseMeasuredWidthsResult {
  const { resolveRoot, signature, enabled = true, nonce = 0, extra, onMeasure } = options
  const boxes = useRef<Map<string, MeasuredBox>>(new Map())
  const signatureRef = useRef(signature)
  const remeasureRef = useRef<() => void>(() => {})

  // Read through refs so a fresh closure each render does not re-run the effect.
  const resolveRef = useRef(resolveRoot)
  resolveRef.current = resolveRoot
  const extraRef = useRef(extra)
  extraRef.current = extra
  const onMeasureRef = useRef(onMeasure)
  onMeasureRef.current = onMeasure

  useIsomorphicLayoutEffect(() => {
    if (signatureRef.current !== signature) {
      signatureRef.current = signature
      boxes.current.clear()
    }
    if (!enabled) {
      // A disabled/detached root leaves no `measure` to re-run — without this a stale closure over
      // the PREVIOUS root's `onMeasure` survives on `remeasureRef` and a later `remeasure()` call
      // (the web-font effect in `controls/actions.tsx`) would measure a root that is no longer live.
      remeasureRef.current = () => {}
      return
    }
    const root = resolveRef.current()
    if (root === null) {
      remeasureRef.current = () => {}
      return
    }
    const measure = (): void => {
      onMeasureRef.current(root, boxes)
    }
    remeasureRef.current = measure
    if (typeof ResizeObserver === 'undefined') {
      measure()
      return
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    for (const el of extraRef.current?.(root) ?? []) {
      if (el !== null) observer.observe(el)
    }
    measure()
    return () => observer.disconnect()
  }, [enabled, signature, nonce])

  return { boxes, remeasure: () => remeasureRef.current() }
}
