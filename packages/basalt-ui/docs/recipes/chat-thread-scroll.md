---
name: chat-thread-scroll
use-when: a scroller that follows a streaming reply to the bottom, releases on a scroll up and survives a late image or the keyboard closing
file: apps/playground/src/recipes/chat-thread-scroll.ts
---

Part of the `chat-thread` recipe. It replaces `use-stick-to-bottom` and `message-scroller`: over a 90 s stream the first lost its pin when the soft keyboard closed, the second ran one line behind; neither is a dependency.
Call it in a component that re-renders with the stream: the no-deps layout effect scrolls in the same task as the commit, and the `ResizeObserver` covers reflow React did not cause.
The scroll element is `ui/scroll-area` (its `ref` is the scroller) with `overflow-anchor: none`. Release is a scroll up with a gap above 8 px; returning within 8 px re-pins.
Real iOS touch scrolling is untested.

```ts
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
```
