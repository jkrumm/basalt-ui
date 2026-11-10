import type { JSX, ReactNode } from 'react'
import { MessageScroller } from '@shadcn/react/message-scroller'

// autoScroll is the one switch that makes it follow a stream; everything else is the defaults.
export function Scroller({ children }: { children: ReactNode }): JSX.Element {
  return (
    <MessageScroller.Provider autoScroll defaultScrollPosition="end">
      <MessageScroller.Root className="root">
        <MessageScroller.Viewport className="scroller" data-scroller>
          <MessageScroller.Content>{children}</MessageScroller.Content>
        </MessageScroller.Viewport>
      </MessageScroller.Root>
    </MessageScroller.Provider>
  )
}

export function Item({ id, children }: { id: string; children: ReactNode }): JSX.Element {
  return (
    <MessageScroller.Item messageId={id} className="msg">
      {children}
    </MessageScroller.Item>
  )
}
