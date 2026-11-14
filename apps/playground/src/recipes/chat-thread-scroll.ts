// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:chat-thread-scroll
import { useLayoutEffect, useRef } from 'react'

const PIN_PX = 8
const pin = (el: HTMLElement | null, pinned: boolean) => {
  if (el && pinned) el.scrollTop = el.scrollHeight
}

/** Pins a scroller to its bottom while its content grows; a scroll up releases, within 8 px re-pins. */
export function useStickToBottom() {
  const ref = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useLayoutEffect(() => pin(ref.current, pinned.current)) // every commit, before paint
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let top = 0
    el.style.overflowAnchor = 'none' // the browser's own anchoring must not move scrollTop
    const observer = new ResizeObserver(() => pin(el, pinned.current)) // a late image, the keyboard
    observer.observe(el)
    observer.observe(el.firstElementChild ?? el)
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight
      pinned.current = gap <= PIN_PX || (pinned.current && el.scrollTop >= top)
      top = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [])
  return ref
}
// #endregion
