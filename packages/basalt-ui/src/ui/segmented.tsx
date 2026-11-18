import { Toggle as BaseToggle } from '@base-ui/react/toggle'
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

/**
 * The `Segmented` cva table: a track holding a row of options, with one raised indicator under the
 * selected one. The track is tinted with an ink mix, so it reads on a card and on the page alike. Each
 * option sizes to its label on one line; a track wider than its box scrolls sideways rather than break
 * a label, and the focus ring sits inside the option so the scroll box does not clip it. The track is at
 * least one control high and a coarse pointer gets the 44 px floor.
 *
 * @example
 * segmentedVariants({ size: 'sm' })
 */
export const segmentedVariants = cva(
  'group/segmented relative inline-flex max-w-full items-stretch overflow-x-auto rounded-ctrl bg-accent p-0.5 [scrollbar-width:none] pointer-coarse:min-h-12',
  {
    variants: {
      size: {
        md: 'min-h-ctl',
        sm: 'min-h-6',
      },
      fill: {
        true: 'flex w-full',
        false: '',
      },
    },
    defaultVariants: { size: 'md', fill: false },
  },
)

// Before the indicator is measured (server render, first paint) and in `multiple` mode the pressed
// option draws its own raised face, so the selection is visible without the script.
const OWN_FACE =
  'group-data-[indicator=false]/segmented:data-pressed:bg-secondary group-data-[indicator=false]/segmented:data-pressed:shadow-raised'

/**
 * The `SegmentedItem` cva table: one option. Its drawn height is the track's; the `::after` overlay
 * reaches 24 px for a fine pointer and 44 px for a coarse one.
 *
 * @example
 * segmentedItemVariants({ size: 'md' })
 */
export const segmentedItemVariants = cva(
  `relative z-10 flex flex-auto shrink-0 cursor-pointer whitespace-nowrap pointer-coarse:min-w-11 items-center justify-center gap-1.5 rounded-[calc(var(--radius-ctrl)-2px)] text-center font-medium text-muted-foreground transition-colors select-none motion-reduce:transition-none group-data-[fill=true]/segmented:flex-1 group-data-[fill=true]/segmented:basis-0 focus-ring focus-visible:-outline-offset-2 after:absolute after:inset-x-0 after:top-1/2 after:h-full after:min-h-6 after:-translate-y-1/2 pointer-coarse:after:min-h-11 hover:text-foreground data-pressed:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 ${OWN_FACE}`,
  {
    variants: {
      size: {
        md: 'px-3 text-sm',
        sm: 'px-2 text-xs',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const segmentedParts = ['segmented', 'segmented-item'] as const

type Size = NonNullable<VariantProps<typeof segmentedVariants>['size']>

type Group = {
  size: Size | null | undefined
  select: ((value: string) => void) | undefined
  /** True while an arrow key is down: the focus it moves is a selection. */
  viaArrow: { current: boolean } | undefined
}
const GroupContext = createContext<Group>({
  size: undefined,
  select: undefined,
  viaArrow: undefined,
})

export type SegmentedOption = {
  value: string
  label: ReactNode
  disabled?: boolean
  /** Names an option whose label is an icon. */
  'aria-label'?: string
}

type Shared = Omit<VariantProps<typeof segmentedVariants>, 'fill'> & {
  /** The track takes its box's width and every option an equal share of it (a phone's full-width switch). */
  fill?: boolean
  disabled?: boolean
  /** Layout only (`w-full`, `mt-2`). Height belongs to `size`. */
  className?: string
  /** Names the group; a wrapping `<fieldset>` legend or `aria-labelledby` does too. */
  'aria-label'?: string
  'aria-labelledby'?: string
}

type Items =
  | {
      /** The options as data; use `children` with `SegmentedItem` when an option has its own layout. */
      options: readonly SegmentedOption[]
      children?: never
    }
  | { options?: never; children: ReactNode }

type Single = {
  multiple?: false
  value?: string
  defaultValue?: string
  /** Fires with the new value. Picking the selected option again keeps it: there is no empty state. */
  onValueChange?: (value: string) => void
}

type Multiple = {
  /** Several options can be on at once; the indicator is not drawn. */
  multiple: true
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: string[]) => void
}

export type SegmentedProps = Shared & Items & (Single | Multiple)

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

type Box = { x: number; w: number } | null

/**
 * A row of options on Base UI's toggle group. Single select (the default) keeps exactly one option
 * on and draws one indicator that slides to it; the arrow keys move the selection through the
 * options in DOM order. `multiple` lets several be on and draws no indicator. Works with no provider.
 *
 * @useWhen a view or a range is one of two to five short options switched in place
 * @neverWhen the options are more than five (use Select), or they open different pages (use Tabs or InnerNav)
 * @example
 * <Segmented value={range} onValueChange={setRange} aria-label="Range"
 *   options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }]} />
 * <Segmented multiple defaultValue={['a']} aria-label="Series">
 *   <SegmentedItem value="a">A</SegmentedItem><SegmentedItem value="b">B</SegmentedItem>
 * </Segmented>
 */
export function Segmented(props: SegmentedProps): ReactElement {
  const { size, fill = false, className, options, children, ...rest } = props
  const multiple = rest.multiple === true
  const [inner, setInner] = useState<string | undefined>(
    rest.multiple === true ? undefined : rest.defaultValue,
  )
  const current = rest.multiple === true ? undefined : (rest.value ?? inner)
  const [box, setBox] = useState<Box>(null)
  const track = useRef<HTMLDivElement>(null)
  const viaArrow = useRef(false)

  useLayoutEffect(() => {
    const root = track.current
    if (multiple || root === null) return
    const measure = (): void => {
      const on = root.querySelector<HTMLElement>('[data-pressed]')
      setBox(on === null ? null : { x: on.offsetLeft, w: on.offsetWidth })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [multiple, current, size, options])

  const select = (value: string): void => {
    if (rest.multiple === true) return
    if (value === current) return
    setInner(value)
    rest.onValueChange?.(value)
  }

  const groupValue =
    rest.multiple === true
      ? { value: rest.value, defaultValue: rest.defaultValue }
      : { value: current === undefined ? [] : [current] }

  const groupProps = {
    multiple,
    disabled: rest.disabled,
    'aria-label': rest['aria-label'],
    'aria-labelledby': rest['aria-labelledby'],
    ...groupValue,
    onValueChange: (next: string[]): void => {
      if (rest.multiple === true) rest.onValueChange?.(next)
      else if (next[0] !== undefined) select(next[0])
    },
  }

  return (
    <GroupContext value={{ size, select: multiple ? undefined : select, viaArrow }}>
      <BaseToggleGroup
        {...groupProps}
        ref={track}
        data-slot="segmented"
        data-indicator={!multiple && box !== null}
        data-fill={fill}
        className={cn(segmentedVariants({ size, fill }), className)}
        onKeyDownCapture={(event: KeyboardEvent) => {
          viaArrow.current = ARROWS.has(event.key)
        }}
        onKeyUpCapture={() => {
          viaArrow.current = false
        }}
      >
        {!multiple && box !== null ? (
          <span
            aria-hidden
            data-pill=""
            style={
              { '--segmented-x': `${box.x}px`, '--segmented-w': `${box.w}px` } as CSSProperties
            }
            className="pointer-events-none absolute inset-y-0.5 left-(--segmented-x) w-(--segmented-w) rounded-[calc(var(--radius-ctrl)-2px)] bg-secondary shadow-raised transition-[left,width] motion-reduce:transition-none"
          />
        ) : null}
        {options === undefined
          ? children
          : options.map((option) => (
              <SegmentedItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                aria-label={option['aria-label']}
              >
                {option.label}
              </SegmentedItem>
            ))}
      </BaseToggleGroup>
    </GroupContext>
  )
}

export type SegmentedItemProps = Omit<
  BaseToggle.Props<string>,
  'className' | 'render' | 'pressed' | 'defaultPressed' | 'onPressedChange' | 'value'
> & {
  value: string
  /** Layout only (`px-4`). */
  className?: string
}

/**
 * One option of a `Segmented`, for an option with its own layout (an icon and a count). It takes
 * the group's `size` and, in single select, becomes the selection when an arrow key reaches it.
 *
 * @example
 * <SegmentedItem value="week">Week</SegmentedItem>
 */
export function SegmentedItem({ className, onFocus, ...props }: SegmentedItemProps): ReactElement {
  const group = useContext(GroupContext)
  return (
    <BaseToggle
      {...props}
      data-slot="segmented-item"
      className={cn(segmentedItemVariants({ size: group.size }), className)}
      onFocus={(event) => {
        onFocus?.(event)
        if (group.viaArrow?.current === true) group.select?.(props.value)
      }}
    />
  )
}
