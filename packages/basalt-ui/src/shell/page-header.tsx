/**
 * Page-header slot system. The slim app-shell top bar carries a GLOBAL slot (shell-owned) and a
 * PAGE slot: the active route portals its full control row into the bar via `PageActions`, so each
 * page owns its actions without a separate in-body header.
 *
 * Grounded verbatim in argo `apps/dashboard/src/components/app-shell/page-header.tsx`. This is a
 * real, working implementation (the slot/portal mechanism has no app coupling) — not a stub.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const TargetContext = createContext<HTMLElement | null>(null)
const SetTargetContext = createContext<(el: HTMLElement | null) => void>(() => {})

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  return (
    <SetTargetContext.Provider value={setTarget}>
      <TargetContext.Provider value={target}>{children}</TargetContext.Provider>
    </SetTargetContext.Provider>
  )
}

/** Renders in the app-shell header — the DOM node the active page portals its actions into. */
export function PageActionsOutlet({ className }: { className?: string }) {
  const setTarget = useContext(SetTargetContext)
  return <div ref={setTarget} className={className} />
}

/** Used by a page to render its control row into the top-bar page slot. */
export function PageActions({ children }: { children: ReactNode }) {
  const target = useContext(TargetContext)
  return target ? createPortal(children, target) : null
}
