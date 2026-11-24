/**
 * The height of an element, measured: the drawer sizes its snaps from its rows, so they ease from one
 * section's height to the next instead of jumping. The ref is a callback: a list in a portal mounts
 * after the component that measures it.
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
