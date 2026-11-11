/**
 * The card portal (S3; concept section 4, "Tooltip internals"): the engine's tooltip, lifted into the
 * top layer and placed by the engine's own `resolveChartTooltipPlacement` inside the nearest
 * `[data-slot=card]`, and inside the plot while it fits there, so a first or last point's tooltip
 * covers no tick label (rows 204, 207, 217). It replaces the 2.x MutationObserver clamp: the engine
 * hands every placement to `position`, and a scroll or resize asks the engine to place again.
 * A placement that does not move writes nothing (invariant 29).
 */
import { resolveChartTooltipPlacement } from '@tanstack/charts/tooltip/model'
import type { TooltipBounds, TooltipSize } from '@tanstack/charts/tooltip/model'
import type {
  ChartTooltipPortalExtension,
  ChartTooltipPortalPositionContext,
} from '@tanstack/charts/tooltip/portal'

/** `card` a chart tooltip (both axes); `slot` a slotted bar chip (the card, no plot fence); `strip`
 * a `BandStrip`'s (held inside the card sideways only). */
export type TipMode = 'card' | 'slot' | 'strip'

const CARD = '[data-slot="card"]'
/** The resolver keeps this much air inside its boundary; a plot fence must leave room for it. */
const EDGE = 8
/** Without an authored placement a tooltip flips above or below its anchor, then slides. */
const VERTICAL = ['top', 'bottom'] as const

function boundary(ctx: ChartTooltipPortalPositionContext, mode: TipMode, size: TooltipSize) {
  const element = ctx.surface.element as HTMLElement
  const doc = element.ownerDocument
  const view = doc.defaultView
  const viewport = { left: 0, top: 0, right: view?.innerWidth ?? 0, bottom: view?.innerHeight ?? 0 }
  const card: TooltipBounds = element.closest(CARD)?.getBoundingClientRect() ?? viewport
  const surface = element.getBoundingClientRect()
  const { width, height, margin } = ctx.scene
  const toClient = (x: number, y: number) => ({
    x: surface.left + (x / width) * surface.width,
    y: surface.top + (y / height) * surface.height,
  })
  const anchor = toClient(ctx.anchor.x, ctx.anchor.y)
  if (mode === 'strip')
    return { anchor, bounds: { ...viewport, left: card.left, right: card.right } }
  if (mode === 'slot') return { anchor, bounds: card }
  const tl = toClient(margin.left, margin.top)
  const br = toClient(width - margin.right, height - margin.bottom)
  const fitsX = br.x - tl.x >= size.width + 2 * EDGE
  const fitsY = br.y - tl.y >= size.height + 2 * EDGE
  const bounds: TooltipBounds = {
    left: fitsX ? Math.max(card.left, tl.x) : card.left,
    right: fitsX ? Math.min(card.right, br.x) : card.right,
    top: fitsY ? Math.max(card.top, tl.y) : card.top,
    bottom: fitsY ? Math.min(card.bottom, br.y) : card.bottom,
  }
  return { anchor, bounds }
}

/** Writes a px value only when it moved: a write that changes nothing is still a style mutation. */
function write(element: HTMLElement, side: 'left' | 'top', value: number): void {
  const current = Number.parseFloat(element.style[side])
  if (Number.isNaN(current) || Math.abs(current - value) > 0.5) element.style[side] = `${value}px`
}

function create(mode: TipMode): ChartTooltipPortalExtension['create'] {
  return ({ container, element, schedulePosition }) => {
    const view = container.ownerDocument.defaultView
    const popover = typeof element.showPopover === 'function'
    if (popover) {
      element.setAttribute('popover', 'manual')
      container.append(element)
    } else container.ownerDocument.body.append(element)
    Object.assign(element.style, { position: 'fixed', margin: '0', right: 'auto', bottom: 'auto' })
    let listening = false
    const listen = (on: boolean): void => {
      if (on === listening) return
      listening = on
      const method = on ? 'addEventListener' : 'removeEventListener'
      view?.[method]('scroll', schedulePosition, { capture: true, passive: true })
      view?.[method]('resize', schedulePosition, { passive: true })
    }
    const hide = (): void => {
      listen(false)
      if (popover && element.matches(':popover-open')) element.hidePopover()
      element.hidden = true
    }
    return {
      update: () => {},
      position(ctx) {
        element.hidden = false
        if (popover && !element.matches(':popover-open')) element.showPopover()
        listen(true)
        const size = { width: element.offsetWidth, height: element.offsetHeight }
        if (!size.width || !size.height || !ctx.scene.width || !ctx.scene.height) return true
        const { anchor, bounds } = boundary(ctx, mode, size)
        const placed = resolveChartTooltipPlacement(
          anchor,
          size,
          bounds,
          ctx.placement ?? VERTICAL,
          ctx.offset,
        )
        write(element, 'left', placed.left)
        write(element, 'top', placed.top)
        if (element.dataset['placement'] !== placed.placement)
          element.dataset['placement'] = placed.placement
        return true
      },
      hide,
      destroy() {
        hide()
        element.removeAttribute('popover')
        element.remove()
      },
    }
  }
}

const PORTALS = new Map<TipMode, ChartTooltipPortalExtension>()

/** One extension per mode, so a recompile hands the engine the same one and it keeps its instance. */
export function cardPortal(mode: TipMode = 'card'): ChartTooltipPortalExtension {
  let found = PORTALS.get(mode)
  if (!found) {
    found = { id: `basalt-card-${mode}`, create: create(mode) }
    PORTALS.set(mode, found)
  }
  return found
}
