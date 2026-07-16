/**
 * ReadingProgress — an opt-in, scroll-driven 2px top bar (docs/CONTENT-SPEC.md §3/§7).
 *
 * Progress is how far `target` (default: the whole document) has been scrolled through the
 * viewport — 0 at the top of `target`, 1 once its bottom edge has cleared the viewport.
 *
 * @example
 * import { ReadingProgress } from 'basalt-ui/content'
 *
 * const articleRef = useRef<HTMLDivElement>(null)
 * <ReadingProgress target={articleRef} />
 * <div ref={articleRef}>…</div>
 */
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import classes from './reading-progress.module.css'

export type ReadingProgressProps = {
  /** The element to track scroll progress through. Default: the whole document. */
  readonly target?: RefObject<HTMLElement | null>
}

function computeProgress(target: HTMLElement | null | undefined): number {
  const viewport = window.innerHeight
  const scrollTop = window.scrollY

  const start = target ? target.getBoundingClientRect().top + scrollTop : 0
  const total = target
    ? target.offsetHeight - viewport
    : document.documentElement.scrollHeight - viewport

  if (total <= 0) return 0
  const ratio = (scrollTop - start) / total
  return Math.min(1, Math.max(0, ratio))
}

export function ReadingProgress({ target }: ReadingProgressProps = {}) {
  const [progress, setProgress] = useState(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      frame.current = null
      setProgress(computeProgress(target?.current))
    }

    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(tick)
    }

    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [target])

  return (
    <div className={classes.root} aria-hidden>
      <div className={classes.fill} style={{ transform: `scaleX(${progress})` }} />
    </div>
  )
}
