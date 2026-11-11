import { Slider as BaseSlider } from '@base-ui/react/slider'
import { cva } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'

/**
 * The `Slider` cva table: a 4 px track with a filled range and 16 px thumbs. The row is 24 px high
 * for a fine pointer and 44 px for a coarse one, and each thumb grows only its invisible `::after`
 * hit area (24 and 44 px), so the drawn control keeps one size. No axes.
 *
 * @example
 * sliderVariants() // class string for a hand-built wrapper
 */
export const sliderVariants = cva(
  'flex h-6 w-full min-w-0 touch-none items-center select-none pointer-coarse:h-11 data-disabled:cursor-not-allowed data-disabled:opacity-50',
)

// A ring that takes the focus outline from its inner range input. Base UI positions it, so the
// class list sets no `position`; the drawn size is 16 px on every pointer and only `::after` grows.
const THUMB =
  'block size-4 cursor-grab rounded-full border-2 border-brand-fill bg-background shadow-raised transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand active:cursor-grabbing data-disabled:cursor-not-allowed'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const sliderParts = ['slider'] as const

type SliderValue = number | readonly number[]

export type SliderProps<Value extends SliderValue = number> = Omit<
  BaseSlider.Root.Props<Value>,
  | 'className'
  | 'children'
  | 'render'
  | 'locale'
  | 'format'
  | 'orientation'
  | 'aria-label'
  | 'aria-labelledby'
> & {
  /** Layout only (`max-w-xs`, `mt-2`). Height belongs to the table. */
  className?: string
  /** Intl options for the value read out to assistive tech (`{ style: 'percent' }`). */
  format?: Intl.NumberFormatOptions
  /** Names every thumb unless `thumbLabels` names them one by one. */
  'aria-label'?: string
  'aria-labelledby'?: string
  /** One name per thumb of a range (`['Minimum price', 'Maximum price']`). */
  thumbLabels?: readonly string[]
}

const thumbCount = (value: SliderValue | undefined): number =>
  typeof value === 'object' ? value.length : 1

/**
 * A slider on Base UI with one thumb (`value` is a number) or two (`value` is `[low, high]`). The
 * value read out to assistive tech is formatted in the page locale (`useFormat`): `1,5` in `de-DE`.
 * `onValueChange` fires on every step while dragging, `onValueCommitted` once on release; use it
 * for a write that is expensive. Arrow keys step by `step`, Shift or Page keys by `largeStep`.
 *
 * @example
 * <Slider value={volume} onValueChange={setVolume} aria-label="Volume" />
 * <Slider defaultValue={[20, 80]} thumbLabels={['From', 'To']} onValueCommitted={save} />
 */
export function Slider<Value extends SliderValue = number>({
  className,
  format: formatOptions,
  thumbLabels,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: SliderProps<Value>): ReactElement {
  const format = useFormat()
  const count = thumbCount(props.value ?? props.defaultValue)
  const named = ariaLabel !== undefined || thumbLabels !== undefined
  const labelOf = (index: number): string | undefined => thumbLabels?.[index] ?? ariaLabel
  return (
    <BaseSlider.Root
      {...props}
      aria-labelledby={ariaLabelledBy}
      data-slot="slider"
      className={cn(sliderVariants(), className)}
    >
      <BaseSlider.Control className="flex h-full w-full items-center">
        <BaseSlider.Track className="h-1 w-full rounded-full bg-input">
          <BaseSlider.Indicator className="rounded-full bg-brand-fill" />
          {Array.from({ length: count }, (_, index) => (
            <BaseSlider.Thumb
              key={index}
              index={index}
              data-thumb=""
              className={THUMB}
              getAriaLabel={named ? () => labelOf(index) ?? '' : null}
              getAriaValueText={(_formatted, current) => format.number(current, formatOptions)}
            />
          ))}
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
