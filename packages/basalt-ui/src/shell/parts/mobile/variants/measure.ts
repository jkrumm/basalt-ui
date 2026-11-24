/**
 * The height of what a section list shows, measured, so the list eases from one section's height to
 * the next instead of jumping (the owner's reference: "height measured so it does not jump"). The
 * ref is a callback: a list in a portal mounts after the component that measures it.
 */
import { useState } from 'react'
import { useIsomorphicLayoutEffect } from '../../../../common/isomorphic-layout-effect'

export function useMeasuredHeight(): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState(0)
  useIsomorphicLayoutEffect(() => {
    if (el === null) return undefined
    const measure = (): void => setHeight(el.offsetHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])
  return [setEl, height]
}

/** The list's cap: it stays in the bottom half of the screen, in reach of the thumb on the bar. */
export const LIST_CAP =
  'max-h-[calc(50dvh-(--spacing(17))-var(--phone-safe-b))] overflow-y-auto overscroll-contain'
