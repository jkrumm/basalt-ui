import type { ReactNode } from 'react'
import type { HoverCtx } from './hover-context'
import { useCallback, useMemo, useState } from 'react'
import { HoverContext } from './hover-context'

export type ChartHoverSyncProps = {
  children: ReactNode
}

type HoverState = {
  date: string | null
  source: string | null
}

/**
 * Activates the shared-cursor HoverContext: holds the hovered date + source
 * chartId in one place so every descendant chart's `useHoverSync` reads and
 * writes the same cursor. Hovering one chart shows a ghost crosshair + dot on
 * all sibling charts under this provider.
 *
 * Wrap a group of charts that should share a cursor in `<ChartHoverSync>`.
 */
export function ChartHoverSync({ children }: ChartHoverSyncProps) {
  // oxlint-disable-next-line react/hook-use-state -- raw setter; renaming shadows setHover (the context callback)
  const [hover, setHoverState] = useState<HoverState>({ date: null, source: null })

  const setHover = useCallback<HoverCtx['setHover']>((date, source) => {
    setHoverState({ date, source })
  }, [])

  const value = useMemo<HoverCtx>(
    () => ({ date: hover.date, source: hover.source, setHover }),
    [hover.date, hover.source, setHover],
  )

  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>
}
