/**
 * `useKeyboardInsetRef` — publishes the live on-screen-keyboard inset as `--vx-keyboard-inset` on
 * a ref'd root element, so `Composer` can stay pinned above a coarse-pointer on-screen keyboard
 * without the consumer hand-rolling a `dvh` clamp (`docs/waves/RESPONSIVE-SPEC.md` §6, the wave 10
 * agent-chat finding). Internal — not exported from the package.
 *
 * Reads `window.visualViewport`, guarded exactly like `useSizeClass`'s `matchMedia` guard
 * (`shell/use-size-class.ts`): absent in SSR and in an engine with no `visualViewport` support
 * (older Safari, and happy-dom/jsdom in tests), where the property is simply never published and
 * CSS's `var(--vx-keyboard-inset, 0px)` fallback carries the zero.
 *
 * The inset is `document.documentElement.clientHeight - visualViewport.height -
 * visualViewport.offsetTop`, floored at 0 — the slice of the LAYOUT viewport's bottom edge the
 * visual viewport no longer covers. `clientHeight` (not `window.innerHeight`) is the layout
 * viewport's height on every engine that also implements `visualViewport`. Both `resize` (fires
 * when the on-screen keyboard opens/closes and shrinks `visualViewport.height`) and `scroll`
 * (fires when the visual viewport's origin moves with no size change — iOS Safari scrolling the
 * page to keep a focused field in view) are subscribed, because either can move the inset on its
 * own.
 *
 * The state-node + layout-effect shape mirrors `shell/page-bar.tsx`'s `useMeasuredHeightVar`: a
 * callback ref stored in state (so the effect re-runs once the node actually mounts) rather than a
 * plain `RefObject` (which is not itself a dependency).
 */
import { useCallback, useState } from 'react'
import { useIsomorphicLayoutEffect } from '../shell/isomorphic-layout-effect'

const KEYBOARD_INSET_VAR = '--vx-keyboard-inset'

export function useKeyboardInsetRef(): (el: HTMLElement | null) => void {
  const [node, setNode] = useState<HTMLElement | null>(null)

  const attach = useCallback((el: HTMLElement | null) => {
    setNode(el)
  }, [])

  useIsomorphicLayoutEffect(() => {
    if (node === null) return
    if (typeof window === 'undefined') return
    const viewport = window.visualViewport
    // `undefined`, not the typed `null`, is what an engine with no support actually returns
    // (confirmed: happy-dom — this package's test DOM — has no `visualViewport` property at all).
    if (viewport === null || viewport === undefined) return

    const publish = (): void => {
      const inset = Math.max(
        0,
        document.documentElement.clientHeight - viewport.height - viewport.offsetTop,
      )
      node.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`)
    }

    publish()
    viewport.addEventListener('resize', publish)
    viewport.addEventListener('scroll', publish)
    return () => {
      viewport.removeEventListener('resize', publish)
      viewport.removeEventListener('scroll', publish)
      node.style.removeProperty(KEYBOARD_INSET_VAR)
    }
  }, [node])

  return attach
}
