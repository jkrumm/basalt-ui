import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { alpha, VX } from '../../tokens'
import { useDismissOnOutside } from '../cursor/touch-pin'
import { LEGEND_ROW_GAP } from './chart-frame-layout'

const DISCLOSURE_PANEL: CSSProperties = {
  position: 'fixed',
  zIndex: VX.zIndexFloating,
  display: 'flex',
  flexDirection: 'column',
  gap: LEGEND_ROW_GAP,
  // theme-allow raw-scroll-container — a fixed floating panel of one legend, not app chrome
  overflowY: 'auto',
  // `<dialog open>` brings UA chrome (centring margin, border, fit-content box) this resets.
  margin: 0,
  border: 'none',
  width: 'auto',
  height: 'auto',
  padding: 10,
  boxSizing: 'border-box',
  backgroundColor: VX.surface.overlay,
  boxShadow: VX.shadowOverlay,
  color: VX.muted,
  borderRadius: VX.radiusCard,
}

/** A popover never collapses below one usable row, however little room the chip leaves. */
const DISCLOSURE_MIN_HEIGHT = 96

/** A popover hangs off its chip (flipping above when there is no room below); a sheet is docked. */
function disclosurePlacement(chip: DOMRect, coarse: boolean): CSSProperties {
  if (coarse) {
    return {
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '60dvh',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
    }
  }
  const below = window.innerHeight - chip.bottom
  const left = Math.max(8, Math.min(chip.left, window.innerWidth - 248))
  const base = { left, right: 'auto', minWidth: 200, maxWidth: 'calc(100vw - 16px)' }
  return below >= 200 || below >= chip.top
    ? { ...base, top: chip.bottom + 4, maxHeight: Math.max(below - 12, DISCLOSURE_MIN_HEIGHT) }
    : {
        ...base,
        bottom: window.innerHeight - chip.top + 4,
        maxHeight: Math.max(chip.top - 12, DISCLOSURE_MIN_HEIGHT),
      }
}

/**
 * `ChartLegend`'s `All N` disclosure state: which button opened it (the chip, or a dots-mode entry)
 * and where the fixed panel sits. Focus moves into the panel on open and back to that trigger on
 * EVERY close path; a scroll outside the panel or a resize closes it, since it is fixed to where the
 * trigger WAS.
 */
export function useLegendDisclosure(coarse: boolean) {
  const [placement, setPlacement] = useState<CSSProperties | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDialogElement>(null)
  const panelId = useId()
  const wasOpen = useRef(false)
  const open = placement !== null
  const close = useCallback(() => setPlacement(null), [])
  const openFrom = (trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setPlacement(disclosurePlacement(trigger.getBoundingClientRect(), coarse))
  }

  useEffect(() => {
    if (open) panelRef.current?.focus()
    else if (wasOpen.current) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  // Shared with the chart cursors' own outside-dismiss (`useChartCursor`/`useDiscreteCursor`, see
  // `touch-pin.ts`); the panel's own scroll is not an outside one.
  const isInsidePanel = useCallback(
    (target: Node): boolean =>
      panelRef.current?.contains(target) === true || triggerRef.current?.contains(target) === true,
    [],
  )
  useDismissOnOutside({
    enabled: open,
    isInside: isInsidePanel,
    onDismiss: close,
    dismissOnResize: true,
    scrollExemptInside: true,
  })

  // The coarse sheet claims `aria-modal` (below), which is a claim that Tab cannot leave it — a
  // native `<dialog open>` (no `showModal()`) does not enforce that on its own (B14). Wrap Tab at
  // the panel's own first/last focusable rather than the fine popover, which is dismissed by an
  // outside click/Escape just as easily and never claimed to be modal in the first place.
  useEffect(() => {
    if (!open || !coarse) return
    const panel = panelRef.current
    if (panel === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [open, coarse])

  return { open, panelId, openFrom, close, panel: { panelRef, panelId, coarse, placement, close } }
}

/** The portalled panel itself — a popover under the chip on a fine pointer, a docked sheet (over a
 * scrim) on a coarse one. Fixed-position, so opening it never grows the legend band. */
export function LegendDisclosure({
  panelRef,
  panelId,
  coarse,
  placement,
  close,
  fontSize,
  children,
}: ReturnType<typeof useLegendDisclosure>['panel'] & {
  fontSize: number
  children: ReactNode
}) {
  if (placement === null) return null
  return createPortal(
    <>
      {coarse && (
        <div
          aria-hidden
          onPointerDown={(e) => {
            e.stopPropagation()
            close()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            // One below the panel it sits behind — still `VX.zIndexFloating`-derived, never a
            // second unrelated literal (B14).
            zIndex: VX.zIndexFloating - 1,
            backgroundColor: alpha(VX.neutral, 0.35),
          }}
        />
      )}
      <dialog
        ref={panelRef}
        id={panelId}
        open
        tabIndex={-1}
        aria-label="Legend"
        {...(coarse && { 'aria-modal': true })}
        data-basalt-legend-disclosure={coarse ? 'sheet' : 'popover'}
        style={{ ...DISCLOSURE_PANEL, fontSize, ...placement }}
      >
        {children}
      </dialog>
    </>,
    document.body,
  )
}
