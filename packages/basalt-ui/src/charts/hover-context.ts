import { createContext } from 'react'

export type HoverCtx = {
  key: string | null
  source: string | null
  setHover: (key: string | null, source: string | null) => void
}

/**
 * Sentinel identity used as the default context's `setHover`. `useHoverSync` compares against it
 * (`ctx.setHover !== DEFAULT_NO_OP_SET_HOVER`) to decide whether a `ChartHoverSync` provider is
 * mounted — which is load-bearing, not just a dev warning: standalone charts (no provider) drive
 * their tooltip + crosshair from local hover, while inside a provider only the broadcast source
 * owns the tooltip. CONTRACT: a real provider MUST supply its own `setHover`, never re-use this
 * no-op (a provider that passes this sentinel would be (mis)read as "no provider").
 * Exported only for that identity check — do NOT call directly.
 */
export const DEFAULT_NO_OP_SET_HOVER: HoverCtx['setHover'] = () => {}

/**
 * Shared-cursor context — charts write the hovered key (an opaque category/date string) + their
 * own chartId; other charts read and show a ghost crosshair + dot on the same key.
 */
export const HoverContext = createContext<HoverCtx>({
  key: null,
  source: null,
  setHover: DEFAULT_NO_OP_SET_HOVER,
})
