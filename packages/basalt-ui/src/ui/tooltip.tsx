import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cva } from 'class-variance-authority'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent, ReactElement } from 'react'
import { cn } from '../core/cn'
import { POPUP_POSITIONER, POPUP_POSITIONER_CLASS } from '../core/popup-position'

/**
 * The `Tooltip` cva table: a one-line label on the popup surface, never wider than 20 rem. It is
 * not hoverable and never takes pointer events, so it cannot cover what it names.
 *
 * @example
 * tooltipVariants() // class string for a hand-built popup
 */
export const tooltipVariants = cva(
  'pointer-events-none max-w-[min(20rem,var(--available-width))] origin-(--transform-origin) rounded-chip break-words border border-border bg-popover px-2 py-1 text-xs shadow-overlay transition-[opacity,scale] duration-fast ease-enter data-ending-style:ease-exit data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const tooltipParts = ['tooltip'] as const

/** How long a touch holds before the label of an icon-only control shows, in ms. */
const LONG_PRESS_MS = 500
/** How long that label stays up after it opened, in ms. */
const TOUCH_SHOW_MS = 2500
/** A touch that travels further than this is a scroll, not a press. */
const LONG_PRESS_SLOP = 10

export type TooltipProps = Pick<
  BaseTooltip.Root.Props,
  'open' | 'defaultOpen' | 'onOpenChange' | 'disabled'
> &
  Pick<BaseTooltip.Positioner.Props, 'side' | 'align' | 'sideOffset'> & {
    /** The text. A string, so it can never hold anything a touch or screen-reader user cannot reach. */
    label: string
    /** The element the label names; it receives the hover and focus handlers. Give it a visible focus. */
    children: ReactElement
    /** Milliseconds of hover before it opens. Default 600. */
    delay?: number
    /** Milliseconds before it closes once the pointer leaves. Default 0. */
    closeDelay?: number
    /** Layout only (`max-w-sm`). Display and stacking belong to the part. */
    className?: string
  }

/**
 * A short label on a trigger, on Base UI: it opens on hover after `delay` and on keyboard focus at
 * once, closes on Escape, blur or leave, and is always portalled above the page. The label is a
 * string and a visual aid only: it is not the trigger's accessible name, so an icon-only button
 * keeps its own `aria-label`. Works with no provider.
 *
 * On touch there is no hover. A trigger that draws its own text (a button with a visible label)
 * does nothing; one that carries the only name of an icon shows the label on a long press (half a
 * second), for a few seconds, and that press does not click the control. Explanatory text is not
 * a tooltip: on a phone it has no way in, so it belongs to `InfoHint`.
 *
 * Which job, which part: name an icon, `Tooltip`; rich or interactive content on hover or press,
 * `Popover` (`PopoverTrigger openOnHover`); a list of actions, `Menu`; explain a frame, its `info`
 * prop.
 *
 * @useWhen an icon or a clipped value needs a one-line name on hover, focus or a long press
 * @neverWhen the content is interactive, longer than a line, or the only place a fact lives (use `Popover`)
 *
 * @example
 * <Tooltip label="Copy link"><Button shape="icon" aria-label="Copy link"><LinkIcon /></Button></Tooltip>
 */
export function Tooltip({
  label,
  children,
  delay = 600,
  closeDelay,
  side,
  align,
  sideOffset = 6,
  className,
  open: controlled,
  onOpenChange,
  ...root
}: TooltipProps): ReactElement {
  const [hovered, setHovered] = useState(root.defaultOpen ?? false)
  const [pressed, setPressed] = useState(false)
  const press = useLongPress(() => setPressed(true))
  useEffect(() => {
    if (!pressed) return undefined
    const timer = setTimeout(() => setPressed(false), TOUCH_SHOW_MS)
    return () => clearTimeout(timer)
  }, [pressed])
  return (
    <BaseTooltip.Root
      {...root}
      open={controlled ?? (hovered || pressed)}
      onOpenChange={(next, details) => {
        setHovered(next)
        if (!next) setPressed(false)
        onOpenChange?.(next, details)
      }}
    >
      <BaseTooltip.Trigger
        render={children}
        delay={delay}
        {...(closeDelay !== undefined && { closeDelay })}
        {...press}
      />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          {...(side !== undefined && { side })}
          {...(align !== undefined && { align })}
          {...POPUP_POSITIONER}
          sideOffset={sideOffset}
          className={POPUP_POSITIONER_CLASS}
        >
          <BaseTooltip.Popup data-slot="tooltip" className={cn(tooltipVariants(), className)}>
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}

/** Whether `el` draws text a reader sees: not inside an `aria-hidden` glyph, not a screen-reader-only span. */
function hasVisibleText(el: Element): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? '').trim() === '') continue
    const hidden = node.parentElement?.closest('[aria-hidden="true"], .sr-only')
    if (hidden === null || hidden === undefined || !el.contains(hidden)) return true
  }
  return false
}

/**
 * The touch path of a tooltip: a held touch calls `onLong`, unless the element draws its own text
 * (that text names it already) or the finger moves (a scroll). The release after a long press must not
 * click the control, and the touch callout must not open over the label.
 */
function useLongPress(onLong: () => void): {
  onPointerDown: (event: PointerEvent<Element>) => void
  onPointerMove: (event: PointerEvent<Element>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onClickCapture: (event: MouseEvent<Element>) => void
  onContextMenu: (event: MouseEvent<Element>) => void
} {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const stop = (): void => {
    clearTimeout(timer.current)
    origin.current = null
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  return {
    onPointerDown(event) {
      fired.current = false
      if (event.pointerType !== 'touch') return
      if (hasVisibleText(event.currentTarget)) return
      origin.current = { x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => {
        origin.current = null
        fired.current = true
        onLong()
      }, LONG_PRESS_MS)
    },
    onPointerMove(event) {
      const from = origin.current
      if (from === null) return
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > LONG_PRESS_SLOP) stop()
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onClickCapture(event) {
      if (!fired.current) return
      fired.current = false
      event.preventDefault()
      event.stopPropagation()
    },
    onContextMenu(event) {
      if (origin.current !== null || fired.current) event.preventDefault()
    },
  }
}
