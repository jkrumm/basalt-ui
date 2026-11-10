import type { JSX, ReactNode } from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'

// The recipe shape: the hook owns the scroll element and the content element, defaults untouched.
export function Scroller({ children }: { children: ReactNode }): JSX.Element {
  const { scrollRef, contentRef } = useStickToBottom()
  return (
    <div className="root">
      <div ref={scrollRef} className="scroller" data-scroller>
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  )
}

export function Item({ children }: { id: string; children: ReactNode }): JSX.Element {
  return <div className="msg">{children}</div>
}
