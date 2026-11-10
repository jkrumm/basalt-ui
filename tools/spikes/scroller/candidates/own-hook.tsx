import { useCallback, useLayoutEffect, useRef } from 'react'
import type { JSX, ReactNode, RefObject } from 'react'

const PIN_PX = 8

/** Pin a scroll element to its bottom while content grows; release on scroll-up, re-pin within 8 px. */
export function useStickToBottom(): {
  scrollRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  pinned: RefObject<boolean>
} {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const lastTop = useRef(0)

  const follow = useCallback(() => {
    const el = scrollRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight - el.clientHeight
  }, [])

  // Every commit of the owner: the DOM has grown, scroll before the browser can paint.
  useLayoutEffect(follow)

  // Reflow React did not cause (a late image, the soft keyboard): same frame, before paint.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    const observer = new ResizeObserver(follow)
    observer.observe(el)
    observer.observe(content)
    const onScroll = (): void => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight
      if (gap <= PIN_PX) pinned.current = true
      else if (el.scrollTop < lastTop.current) pinned.current = false
      lastTop.current = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [follow])

  return { scrollRef, contentRef, pinned }
}

export function Scroller({ children }: { children: ReactNode }): JSX.Element {
  const { scrollRef, contentRef } = useStickToBottom()
  return (
    <div className="root">
      <div ref={scrollRef} className="scroller" data-scroller style={{ overflowAnchor: 'none' }}>
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  )
}

export function Item({ children }: { id: string; children: ReactNode }): JSX.Element {
  return <div className="msg">{children}</div>
}
