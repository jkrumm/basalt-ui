/**
 * Ref plumbing for composites (Blueprint audit §2). React 19 made `ref` an ordinary prop, which
 * removed `forwardRef` — it did NOT remove the need to merge: a component that both forwards its
 * caller's ref and keeps its own (a measurement, a focus target) still has two refs and one node.
 *
 * The React 19 wrinkle these two functions exist to get right: a callback ref MAY return a cleanup
 * function, and when it does React never calls it again with `null`. So merging cannot just fan out
 * — it has to fan out the cleanups too, and null out the refs that returned none.
 */
import type { Ref, RefCallback } from 'react'

/**
 * Writes `value` into one ref of either shape.
 *
 * @returns the callback ref's own cleanup when it returned one, else `undefined`.
 */
export function assignRef<T>(ref: Ref<T> | undefined, value: T | null): (() => void) | undefined {
  if (ref === undefined || ref === null) return undefined
  if (typeof ref === 'function') {
    const cleanup = ref(value)
    return typeof cleanup === 'function' ? cleanup : undefined
  }
  // `@types/react` 19 types `RefObject.current` as MUTABLE — the readonly `current` that forced a
  // cast here was the React 18 `RefObject`, and `Ref<T>` now narrows to `RefObject<T | null>`.
  ref.current = value
  return undefined
}

/**
 * Fans one node out to several refs.
 *
 * Returns a NEW function on every call, so a component that passes it straight to JSX re-attaches
 * on every render — wrap it in `useCallback`/`useMemo` over the refs it merges when the node is
 * expensive to re-attach.
 *
 * @example
 * const merged = useMemo(() => mergeRefs(ref, localRef), [ref])
 * return <div ref={merged} />
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value: T | null) => {
    const cleanups = refs.map((ref) => assignRef(ref, value))
    // No child returned a cleanup → stay on React's legacy path and let it call us with `null`.
    if (cleanups.every((cleanup) => cleanup === undefined)) return undefined
    // At least one did → React will call THIS instead of re-invoking with `null`, so the refs that
    // returned no cleanup have to be cleared here or they keep pointing at a detached node.
    return () => {
      refs.forEach((ref, index) => {
        const cleanup = cleanups[index]
        if (cleanup !== undefined) {
          cleanup()
          return
        }
        assignRef(ref, null)
      })
    }
  }
}
