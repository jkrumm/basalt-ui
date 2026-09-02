/**
 * ReadingProgress — an opt-in, scroll-driven 2px top bar (docs/CONTENT-SPEC.md §3/§7).
 *
 * Progress is how far `target` (default: the whole scrollport) has been scrolled through the
 * viewport — 0 at the top of `target`, 1 once its bottom edge has cleared the viewport.
 *
 * WHICH BOX SCROLLS is resolved, never assumed: inside `BasaltShell` the scroller is
 * `AppShell.Main` (`shell/app-main.module.css`), where `window.scrollY` is pinned at 0 and a
 * `scroll` listener on `window` never fires. `scrollParentOf` answers `null` for a shell-less app
 * and this falls back to the window unchanged.
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
import type { BasaltProps } from '../common/props'
import { cx } from '../common/props'
import { scrollParentOf } from '../common/scroll-parent'
import classes from './reading-progress.module.css'

export type ReadingProgressProps = BasaltProps & {
  /** The element to track scroll progress through. Default: the whole scrollport. */
  readonly target?: RefObject<HTMLElement | null>
}

/**
 * `port` is the resolved scrollport, or `null` for "the document scrolls". The only thing that
 * changes between the two is where the four numbers come from — `target`'s offset is measured
 * against the SCROLLER's own top edge rather than the viewport's, which for the window case is the
 * same edge and reduces to the original arithmetic.
 */
function computeProgress(target: HTMLElement | null | undefined, port: HTMLElement | null): number {
  const viewport = port ? port.clientHeight : window.innerHeight
  const scrollTop = port ? port.scrollTop : window.scrollY
  const originTop = port ? port.getBoundingClientRect().top : 0
  const scrollable = port ? port.scrollHeight : document.documentElement.scrollHeight

  const start = target ? target.getBoundingClientRect().top - originTop + scrollTop : 0
  const total = target ? target.offsetHeight - viewport : scrollable - viewport

  if (total <= 0) return 0
  const ratio = (scrollTop - start) / total
  return Math.min(1, Math.max(0, ratio))
}

export function ReadingProgress({ target, className, style }: ReadingProgressProps = {}) {
  const [progress, setProgress] = useState(0)
  const frame = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // The bar itself is a fine probe when there is no `target`: it is mounted inside whatever
    // region the reader is scrolling, which is the box this is measuring.
    const port = scrollParentOf(target?.current ?? rootRef.current)
    const scroller: Window | HTMLElement = port ?? window

    const tick = () => {
      frame.current = null
      setProgress(computeProgress(target?.current, port))
    }

    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(tick)
    }

    tick()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [target])

  return (
    <div
      ref={rootRef}
      className={cx(classes.root, className)}
      aria-hidden
      {...(style !== undefined && { style })}
    >
      <div className={classes.fill} style={{ transform: `scaleX(${progress})` }} />
    </div>
  )
}
