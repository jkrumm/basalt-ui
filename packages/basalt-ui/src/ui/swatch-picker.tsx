import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { cva } from 'class-variance-authority'
import { useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, ReactElement } from 'react'
import { cn } from '../core/cn'
import { ACCENT_FILLS } from '../core/appearance'
import type { AccentName } from '../core/appearance'
import { base as baseMessages } from '../core/messages/base'
import { useMessages } from '../core/messages/use-messages'
import { buttonVariants } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/**
 * The named colour tokens a swatch can carry. A free colour value is not a choice: the palette decides.
 * `accent-<name>` is one of the package's accents (`ACCENTS`, basalt-ui/tokens), painted in that
 * accent's own fill whatever accent the page wears: the swatches of an accent picker.
 */
export const SWATCH_TOKENS = [
  'neutral',
  'brand',
  'good',
  'warn',
  'bad',
  'info',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'accent-blue',
  'accent-violet',
  'accent-rose',
  'accent-orange',
  'accent-green',
  'accent-teal',
] as const

export type SwatchToken = (typeof SWATCH_TOKENS)[number]

/** Each token's fill class, written out in full so the stylesheet generator sees every one. */
const FILL: Record<SwatchToken, string> = {
  neutral: 'bg-muted-foreground',
  brand: 'bg-brand-fill',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
  'accent-blue': 'bg-(--swatch-fill)',
  'accent-violet': 'bg-(--swatch-fill)',
  'accent-rose': 'bg-(--swatch-fill)',
  'accent-orange': 'bg-(--swatch-fill)',
  'accent-green': 'bg-(--swatch-fill)',
  'accent-teal': 'bg-(--swatch-fill)',
}

/** An accent swatch's fill, as the `--swatch-fill` its class reads; none for a theme token. */
function fillStyle(token: SwatchToken): CSSProperties | undefined {
  if (!token.startsWith('accent-')) return undefined
  return {
    '--swatch-fill': ACCENT_FILLS[token.slice('accent-'.length) as AccentName],
  } as CSSProperties
}

/**
 * The `SwatchPicker` cva table: the grid the swatches sit in, four to a row. A coarse pointer opens
 * the gaps so the 44 px hit areas of two swatches never overlap. No axes.
 *
 * @example
 * swatchPickerVariants() // class string for a hand-built grid
 */
export const swatchPickerVariants = cva('grid w-fit grid-cols-4 gap-2 pointer-coarse:gap-4')

/**
 * The swatch table: a 28 px disc of one token. It stays 28 px on every pointer and grows only its
 * invisible `::after` hit area to 44 px for a coarse one. The picked swatch carries a check and a
 * ring set off from the disc, so the state never rides on colour alone.
 */
const swatchVariants = cva(
  'relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-on-brand focus-ring transition-shadow after:absolute after:top-1/2 after:left-1/2 after:size-7 after:-translate-1/2 pointer-coarse:after:size-11 hover:opacity-90 data-checked:ring-2 data-checked:ring-foreground data-checked:ring-offset-2 data-checked:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const swatchPickerParts = ['swatch-picker'] as const

export type SwatchOption = {
  value: SwatchToken
  /** The colour's name; every swatch is named by it, never by its colour. */
  label: string
  disabled?: boolean
}

export type SwatchPickerProps = {
  options: readonly SwatchOption[]
  value?: SwatchToken | undefined
  onValueChange?: (value: SwatchToken) => void
  /** `inline` draws the grid in place; `menu` draws a trigger with the picked colour that opens it. */
  display?: 'inline' | 'menu'
  name?: string
  disabled?: boolean
  required?: boolean
  'aria-invalid'?: boolean
  /** Names the picker. Required: a swatch has no text of its own. */
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  /** Fires once when focus leaves the picker (the menu: when it closes): the validate-on-blur hook. */
  onBlur?: () => void
  /** Layout only (`w-fit`). */
  className?: string
}

function Dot({ token }: { token: SwatchToken }): ReactElement {
  return (
    <span
      aria-hidden="true"
      style={fillStyle(token)}
      className={cn('size-3 shrink-0 rounded-full', FILL[token])}
    />
  )
}

/**
 * A small set of named colour tokens as swatches, picked by a ring and a check. The value is the
 * token's name (`brand`, `chart-3`), never a colour value, so a picked colour follows the theme in
 * both schemes. `display="menu"` folds the grid into a popover behind a trigger that shows the
 * picked colour, for a field with little room. Arrow keys move through the swatches; it joins a Base
 * UI `Field` when wrapped in one.
 *
 * @useWhen the user tags a record with one colour of the palette: a stage, a label, a calendar
 * @neverWhen any colour is allowed (a free colour picker is not part of basalt) or the choice is not a colour
 * @example
 * <SwatchPicker aria-label="Stage colour" value={colour} onValueChange={setColour}
 *   options={[{ value: 'good', label: 'Green' }, { value: 'warn', label: 'Amber' }]} />
 */
export function SwatchPicker({
  options,
  value,
  onValueChange,
  display = 'inline',
  name,
  disabled = false,
  required,
  'aria-invalid': invalid = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  onBlur,
  className,
}: SwatchPickerProps): ReactElement {
  const t = useMessages(baseMessages)
  const [open, setOpen] = useState(false)
  // A Space press selects through the radio's own click, which comes after the key: the menu closes on that click.
  const spaceDown = useRef(false)
  const pick = () => {
    setOpen(false)
    onBlur?.()
  }
  const picked = options.find((option) => option.value === value)
  const triggerName =
    ariaLabel === undefined || picked === undefined ? ariaLabel : `${ariaLabel}: ${picked.label}`

  const onFocusOut = (event: FocusEvent<HTMLDivElement>): void => {
    if (display === 'menu') return
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return
    onBlur?.()
  }

  const grid = (
    <BaseRadioGroup
      value={picked === undefined ? null : picked.value}
      disabled={disabled}
      {...(required !== undefined && { required })}
      {...(name !== undefined && display === 'inline' && { name })}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid || undefined}
      data-slot="swatch-picker"
      className={cn(swatchPickerVariants(), display === 'inline' && className)}
      onBlur={onFocusOut}
      onValueChange={(next) => onValueChange?.(next as SwatchToken)}
      onKeyDown={(event) => {
        if (display !== 'menu') return
        if (event.key === ' ') spaceDown.current = true
        if (event.key === 'Enter' && picked !== undefined) pick()
      }}
    >
      {options.map((option) => (
        <BaseRadio.Root
          key={option.value}
          value={option.value}
          disabled={option.disabled ?? false}
          aria-label={option.label}
          // An arrow key selects a radio by clicking it with no pointer (detail 0): browsing must not close the menu.
          onClick={(event) => {
            if (display !== 'menu') return
            const fromSpace = spaceDown.current
            spaceDown.current = false
            if (event.detail > 0 || fromSpace) pick()
          }}
          style={fillStyle(option.value)}
          className={cn(swatchVariants(), FILL[option.value])}
        >
          <BaseRadio.Indicator>
            <svg
              viewBox="0 0 12 12"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
            </svg>
          </BaseRadio.Indicator>
        </BaseRadio.Root>
      ))}
    </BaseRadioGroup>
  )
  if (display === 'inline') return grid

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onBlur?.()
      }}
    >
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'secondary' }), 'justify-start', className)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        aria-label={triggerName}
      >
        {picked === undefined ? null : <Dot token={picked.value} />}
        {picked?.label}
      </PopoverTrigger>
      <PopoverContent
        {...(ariaLabelledBy === undefined
          ? { 'aria-label': ariaLabel ?? t('base.swatch.menu') }
          : { 'aria-labelledby': ariaLabelledBy })}
        className="w-auto"
      >
        {grid}
      </PopoverContent>
      {name !== undefined && <input type="hidden" name={name} value={picked?.value ?? ''} />}
    </Popover>
  )
}
