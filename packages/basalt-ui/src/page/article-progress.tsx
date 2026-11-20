import type { ReactElement, RefObject } from 'react'
import { useEffect, useId, useRef } from 'react'
import { scrollParentOf } from '../common/scroll-parent'

export type ArticleProgressProps = {
  /** The element to track scroll progress through. Default: the whole scrollport. */
  target?: RefObject<HTMLElement | null>
}

/**
 * The thin fixed bar `ArticleLayout` shows for `readingProgress`: 0 at the top of `target`, 1 once
 * its bottom edge has cleared the viewport. Internal: not exported from the barrel.
 *
 * The compositor draws it: the fill's `animation-timeline` is a named scroll timeline on the
 * resolved scroller (`scrollParentOf`: inside the shell the main region, otherwise the document),
 * or a view timeline on `target` ranged from its start edge at the scrollport's start to its end
 * edge at the scrollport's end. No scroll listener, no frame callback, no layout read. The names
 * are declared in an effect because the scroller is found by walking the DOM.
 *
 * An engine without scroll timelines never shows the bar: it is an affordance, not content, and
 * `aria-hidden` for the same reason. Reduced motion keeps it; the bar is position, not motion.
 */
export function ArticleProgress({ target }: ArticleProgressProps = {}): ReactElement {
  const name = `--article-progress-${useId().replaceAll(/\W/g, '')}`
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const bar = rootRef.current
    if (bar === null || !CSS.supports('animation-timeline', 'auto')) return
    const subject = target?.current ?? null
    // A view timeline is looked up from the bar, which is not inside `target`: scope it to the
    // nearest ancestor that holds both. A scroll timeline is on an ancestor of the bar already.
    let host: HTMLElement
    let property: 'scrollTimeline' | 'viewTimeline'
    let scope: HTMLElement | null = null
    if (subject === null) {
      host = scrollParentOf(bar) ?? bar.ownerDocument.documentElement
      property = 'scrollTimeline'
    } else {
      host = subject
      property = 'viewTimeline'
      scope = subject.parentElement
      while (scope !== null && !scope.contains(bar)) scope = scope.parentElement
    }
    const previous = host.style[property]
    const previousScope = scope?.style.timelineScope ?? ''
    host.style[property] = `${name} y`
    if (scope !== null) scope.style.timelineScope = name
    return () => {
      host.style[property] = previous
      if (scope !== null) scope.style.timelineScope = previousScope
    }
  }, [target, name])

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 hidden h-0.5 supports-[animation-timeline:auto]:block"
    >
      <div
        className="h-full origin-left bg-brand will-change-transform"
        style={{
          // The resting state until a timeline is in scope: an unresolved name leaves the bar at 0.
          transform: 'scaleX(0)',
          animationName: 'basalt-article-progress',
          // oxlint-disable-next-line basalt/motion-literal -- a scroll timeline maps scroll to progress 1:1; any curve would bend it
          animationTimingFunction: 'linear',
          animationFillMode: 'both',
          animationTimeline: name,
          animationRange: target === undefined ? undefined : 'entry 100% exit 0%',
        }}
      />
    </div>
  )
}
