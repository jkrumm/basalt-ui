import type { ReactElement, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { scrollParentOf } from '../common/scroll-parent'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'

export type ArticleProgressProps = {
  /** The element to track scroll progress through. Default: the whole scrollport. */
  target?: RefObject<HTMLElement | null>
}

/**
 * `port` is the resolved scrollport, or `null` for "the document scrolls". The only thing that
 * changes between the two is where the four numbers come from; `target`'s offset is measured
 * against the scroller's own top edge rather than the viewport's.
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

/**
 * The thin fixed bar `ArticleLayout` shows for `readingProgress`: 0 at the top of `target`, 1 once
 * its bottom edge has cleared the viewport. The scroller is resolved (`scrollParentOf`), never
 * assumed: inside the shell it is the main region, otherwise the window. Internal: not exported
 * from the barrel.
 */
export function ArticleProgress({ target }: ArticleProgressProps = {}): ReactElement {
  const t = useMessages(page)
  const [progress, setProgress] = useState(0)
  const frame = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // The bar is a fine probe when there is no `target`: it sits inside the box being read.
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
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a fixed scaleX bar over the page, not a form <progress>
      role="progressbar"
      aria-label={t('page.progress')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <div
        className="h-full origin-left bg-brand will-change-transform"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  )
}
