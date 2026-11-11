import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement, Ref } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../core/cn'

/**
 * The `ScrollArea` cva table: a native scroller with a thin scrollbar in the line token. `orientation`
 * is the axis it scrolls on; the other axis is clipped. It is focusable only while it scrolls (see
 * `ScrollArea`).
 *
 * @example
 * scrollAreaVariants({ orientation: 'horizontal' })
 */
export const scrollAreaVariants = cva(
  'relative min-h-0 min-w-0 rounded-sm focus-ring [scrollbar-color:var(--vx-line)_transparent] [scrollbar-width:thin]',
  {
    variants: {
      orientation: {
        vertical: 'overflow-x-hidden overflow-y-auto',
        horizontal: 'overflow-x-auto overflow-y-hidden',
        both: 'overflow-auto',
      },
    },
    defaultVariants: { orientation: 'vertical' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const scrollAreaParts = ['scroll-area'] as const

const CONTENT = {
  vertical: '',
  horizontal: 'w-max min-w-full',
  both: 'w-max min-w-full',
} as const

export type ScrollAreaProps = Omit<ComponentProps<'div'>, 'className' | 'tabIndex'> &
  VariantProps<typeof scrollAreaVariants> & {
    /** Layout and the bound that makes it scroll (`max-h-64`, `h-full`). */
    className?: string
  }

function setRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

/**
 * A scrolling region. It takes `tabindex="0"` only while its content overflows, so a keyboard user
 * can scroll it with the arrow keys and a region that fits adds no tab stop. Bound its size with
 * `max-h-*` or a flex parent, and name it with `aria-label` (it then reads as a region). Content is
 * wrapped in one plain `div` that the overflow is measured on.
 *
 * @example
 * <ScrollArea aria-label="Activity" className="max-h-64">{rows}</ScrollArea>
 */
export function ScrollArea({
  orientation,
  className,
  children,
  ref,
  ...props
}: ScrollAreaProps): ReactElement {
  const outer = useRef<HTMLDivElement | null>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = useState(false)
  const own = useCallback(
    (node: HTMLDivElement | null) => {
      outer.current = node
      setRef(ref, node)
    },
    [ref],
  )

  useEffect(() => {
    const el = outer.current
    const content = inner.current
    if (el === null || content === null) return undefined
    const measure = (): void =>
      setScrolls(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
  return (
    <div
      role={scrolls && named ? 'region' : undefined}
      {...props}
      ref={own}
      tabIndex={scrolls ? 0 : undefined}
      data-slot="scroll-area"
      className={cn(scrollAreaVariants({ orientation }), className)}
    >
      <div ref={inner} className={CONTENT[orientation ?? 'vertical']}>
        {children}
      </div>
    </div>
  )
}
