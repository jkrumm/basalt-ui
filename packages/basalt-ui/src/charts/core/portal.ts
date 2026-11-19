/**
 * The card portal (S3; concept section 4, "Tooltip internals"): the engine's tooltip, lifted into the
 * top layer and placed by the engine's own `resolveChartTooltipPlacement` inside the nearest
 * `[data-slot=card]`, and inside the plot while it fits there, so a first or last point's tooltip
 * covers no tick label (rows 204, 207, 217). It replaces the 2.x MutationObserver clamp: the engine
 * hands every placement to `position`, and a scroll or resize asks the engine to place again.
 * A placement that does not move writes nothing (invariant 29).
 *
 * A tooltip keeps its side for as long as it shows: the side it took first is tried first at every
 * later datum, so it changes side only when it would leave its boundary there, and then keeps the new
 * one. Owner review 2 saw the first fitting side re-picked per datum: a line's tooltip flipped above
 * and below the next point, the height of itself for a 10 px pointer move.
 */
import { resolveChartTooltipPlacement } from '@tanstack/charts/tooltip/model'
import type { TooltipBounds, TooltipSize } from '@tanstack/charts/tooltip/model'
import type { ChartTooltipPlacement } from '@tanstack/charts/types/core'
import type {
  ChartTooltipPortalExtension,
  ChartTooltipPortalPositionContext,
} from '@tanstack/charts/tooltip/portal'

/** `card` a chart tooltip (both axes); `slot` a slotted bar chip (the card, no plot fence); `strip`
 * a `BandStrip`'s (held inside the card sideways only). */
export type TipMode = 'card' | 'slot' | 'strip'

const CARD = '[data-slot="card"]'
/** Air between a strip tooltip opened below and the scene's bottom edge (under the x tick labels), px. */
const STRIP_TICK_AIR = 2
/** The resolver keeps this much air inside its boundary; a plot fence must leave room for it. */
const EDGE = 8
/** Without an authored placement a tooltip flips above or below its anchor, then slides. */
const VERTICAL = ['top', 'bottom'] as const

type Boundary = {
  anchor: { x: number; y: number }
  bounds: TooltipBounds
  /** The lowest top a tooltip placed below the anchor may take, client px. */
  clear?: number
}

function boundary(
  ctx: ChartTooltipPortalPositionContext,
  mode: TipMode,
  size: TooltipSize,
): Boundary {
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
  // A strip tooltip opens below the plot, and the x tick labels sit in the scene's bottom margin: it starts under the scene.
  if (mode === 'strip')
    return {
      anchor,
      bounds: { ...viewport, left: card.left, right: card.right },
      clear: surface.bottom + STRIP_TICK_AIR,
    }
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

/**
 * A tooltip placed beside a column clears the column's own half width: the anchor is its centre, the
 * engine's gap measures from there. Client px; 0 above or below, and where the x scale has no band.
 */
function besideColumn(ctx: ChartTooltipPortalPositionContext, placement: string): number {
  if (placement !== 'left' && placement !== 'right') return 0
  const half = (ctx.scene.scales?.['x']?.bandwidth ?? 0) / 2
  const element = ctx.surface.element as HTMLElement
  const scale = ctx.scene.width > 0 ? element.getBoundingClientRect().width / ctx.scene.width : 1
  return (placement === 'right' ? half : -half) * scale
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
    // The one-line chip's look (`chart-box.module.css`) hangs on this marker.
    if (mode === 'slot') element.dataset['basaltSlot'] = ''
    let listening = false
    const listen = (on: boolean): void => {
      if (on === listening) return
      listening = on
      const method = on ? 'addEventListener' : 'removeEventListener'
      view?.[method]('scroll', schedulePosition, { capture: true, passive: true })
      view?.[method]('resize', schedulePosition, { passive: true })
    }
    // The side this showing took; a hide ends the showing, so the next one picks afresh.
    let kept: ChartTooltipPlacement | undefined
    const hide = (): void => {
      kept = undefined
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
        const { anchor, bounds, clear } = boundary(ctx, mode, size)
        // The kept side first, then the rest in their order: the resolver takes the first that fits.
        // A chart hands a list of sides or none (`compile.ts`); none is the vertical pair.
        const sides: readonly ChartTooltipPlacement[] =
          typeof ctx.placement === 'object' ? ctx.placement : VERTICAL
        const placed = resolveChartTooltipPlacement(
          anchor,
          size,
          bounds,
          kept !== undefined && sides.includes(kept)
            ? [kept, ...sides.filter((side) => side !== kept)]
            : sides,
          ctx.offset,
        )
        kept = placed.placement
        write(element, 'left', placed.left + besideColumn(ctx, placed.placement))
        write(
          element,
          'top',
          clear !== undefined && placed.placement === 'bottom'
            ? Math.max(placed.top, clear)
            : placed.top,
        )
        if (element.dataset['placement'] !== placed.placement)
          element.dataset['placement'] = placed.placement
        return true
      },
      hide,
      destroy() {
        hide()
        element.removeAttribute('popover')
        delete element.dataset['basaltSlot']
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
