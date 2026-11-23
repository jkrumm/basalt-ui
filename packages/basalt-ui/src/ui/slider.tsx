import { Slider as BaseSlider } from '@base-ui/react/slider'
import { cva } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'

/**
 * The `Slider` cva table: a 4 px track with a filled range. The row is 24 px high for a fine pointer
 * and 44 px for a coarse one. No axes.
 *
 * @example
 * sliderVariants() // class string for a hand-built wrapper
 */
export const sliderVariants = cva(
  'flex h-6 w-full min-w-0 touch-none items-center select-none pointer-coarse:h-11 data-disabled:cursor-not-allowed data-disabled:opacity-50',
)

// The thumb is the hit area: 24 px, 44 px on a coarse pointer, so the nested range input fills it and
// is a 24 px control. The drawn ring is its `::before` at 16 px, and takes the focus outline from the
// input. Base UI positions the thumb, so the class list sets no `position`.
const THUMB =
  'block size-6 cursor-grab transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-4 before:-translate-1/2 before:rounded-full before:border-2 before:border-brand-fill before:bg-background before:shadow-raised before:transition-colors pointer-coarse:size-11 has-focus-visible:before:outline-2 has-focus-visible:before:outline-offset-2 has-focus-visible:before:outline-brand active:cursor-grabbing data-disabled:cursor-not-allowed'

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
  /** Prints the current value at the end of the track, formatted with `format`; a range reads `a – b`. */
  showValue?: boolean
}

const thumbCount = (value: SliderValue | undefined): number =>
  typeof value === 'object' ? value.length : 1

/**
 * A slider on Base UI with one thumb (`value` is a number) or two (`value` is `[low, high]`). The
 * value read out to assistive tech is formatted in the page locale (`useFormat`): `1,5` in `de-DE`.
 * `onValueChange` fires on every step while dragging, `onValueCommitted` once on release; use it
 * for a write that is expensive. Arrow keys step by `step`, Shift or Page keys by `largeStep`.
 *
 * @useWhen a number or a low-high range is picked on a bounded scale and approximate is fine
 * @neverWhen the exact value matters (use NumberField) or the choices are a few named options (use Segmented or RadioGroup)
 * @example
 * <Slider value={volume} onValueChange={setVolume} aria-label="Volume" />
 * <Slider defaultValue={[20, 80]} thumbLabels={['From', 'To']} onValueCommitted={save} />
 */
export function Slider<Value extends SliderValue = number>({
  className,
  format: formatOptions,
  thumbLabels,
  showValue,
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
      <BaseSlider.Control className="flex h-full w-full min-w-0 items-center">
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
      {showValue === true && (
        <BaseSlider.Value className="shrink-0 pl-3 text-sm text-muted-foreground tabular-nums">
          {(_formatted, values) =>
            values.map((value) => format.number(value, formatOptions)).join(' – ')
          }
        </BaseSlider.Value>
      )}
    </BaseSlider.Root>
  )
}
