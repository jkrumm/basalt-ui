import type { ReactNode } from 'react'
import type { HoverCtx } from './hover-context'
import { useCallback, useMemo, useState } from 'react'
import { HoverContext } from './hover-context'

export type ChartHoverSyncProps = {
  children: ReactNode
}

type HoverState = {
  key: string | null
  source: string | null
}

/**
 * Activates the shared-cursor HoverContext: holds the hovered key (an opaque
 * category/date string) + source chartId in one place so every descendant
 * chart's `useHoverSync` reads and writes the same cursor. Hovering one chart
 * shows a ghost crosshair + dot on all sibling charts under this provider.
 *
 * Wrap a group of charts that should share a cursor in `<ChartHoverSync>`.
 */
export function ChartHoverSync({ children }: ChartHoverSyncProps) {
  // oxlint-disable-next-line react/hook-use-state -- raw setter; renaming shadows setHover (the context callback)
  const [hover, setHoverState] = useState<HoverState>({ key: null, source: null })

  const setHover = useCallback<HoverCtx['setHover']>((key, source) => {
    setHoverState({ key, source })
  }, [])

  const value = useMemo<HoverCtx>(
    () => ({ key: hover.key, source: hover.source, setHover }),
    [hover.key, hover.source, setHover],
  )

  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>
}
