// theme-allow-file raw-selection-control — the selects here are the v3 ui/select primitive, bound to a ControlHandle by ControlView
/**
 * One renderer per `handle.kind`. A renderer draws the input only: the label, the override cue and
 * the reset belong to `ControlView`, so a renderer cannot forget them. The `as` hint of a spec picks
 * a sibling form of the same kind; an unknown hint falls back to the kind's default.
 *
 * | kind | default | `as` |
 * |-|-|-|
 * | enum | `select` | `segmented` |
 * | multi | `combobox` | `segmented` |
 * | string | `input` | `search` |
 * | number | `number` | `slider` (needs `min` and `max`) |
 * | boolean | `switch` | `checkbox` |
 * | range | `select` | `segmented` |
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useMessages } from '../core/messages/use-messages'
import { controls } from '../core/messages/controls'
import type { ControlHandle } from '../core/ports'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Combobox, ComboboxChips, ComboboxContent, ComboboxItem } from '../ui/combobox'
import { Input } from '../ui/input'
import { NumberField } from '../ui/number-field'
import { Segmented } from '../ui/segmented'
import { Select } from '../ui/select'
import { Slider } from '../ui/slider'
import { Switch } from '../ui/switch'
import type { FilterSpec } from './contract'
import { useCommittedField } from './use-committed-field'
import type { CommittedField } from './use-committed-field'

export type ControlSize = 'sm' | 'md'

export type RendererProps<T> = {
  spec: FilterSpec<T>
  value: T
  onChange(next: T): void
  /** Unsets the field (`handle.clear()`): the way a number or an enum is emptied. */
  onClear(): void
  size: ControlSize
  /** Layout only: the width the home gives the control. */
  className: string
}

type Option = { value: string; label: string }
type Bounds = { min?: number; max?: number; step?: number; int?: boolean }

/** The catalogue of a spec: its own `options`, else the handle's. A multi's are its members. */
function optionsOf<T>(spec: FilterSpec<T>): readonly Option[] {
  const own = (spec.options ?? spec.handle.options ?? []) as readonly Option[]
  const counts = new Map<unknown, number>((spec.facets ?? []).map((f) => [f.value, f.count]))
  if (counts.size === 0) return own
  return own.map((o) => {
    const count = counts.get(o.value)
    return count === undefined ? o : { value: o.value, label: `${o.label} (${count})` }
  })
}

const boundsOf = <T,>(handle: ControlHandle<T>): Bounds =>
  ((handle as { bounds?: Bounds }).bounds ?? {}) as Bounds

function ClearButton({
  label,
  clear,
}: {
  label: string
  clear: CommittedField<never>['clearProps']
}): ReactElement {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      data-control-clear=""
      onMouseDown={clear.onMouseDown}
      onClick={clear.onClick}
    >
      <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
        <path
          d="M4 4l8 8M12 4l-8 8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </Button>
  )
}

// ---- enum --------------------------------------------------------------------------------

function EnumRenderer({
  spec,
  value,
  onChange,
  size,
  className,
}: RendererProps<string>): ReactElement {
  const options = optionsOf(spec)
  if (spec.as === 'segmented') {
    return (
      <Segmented
        aria-label={spec.label}
        size={size}
        className={className}
        options={options}
        value={value}
        onValueChange={onChange}
      />
    )
  }
  return (
    <Select<string>
      aria-label={spec.label}
      size={size}
      className={className}
      options={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next)
      }}
      {...(spec.placeholder !== undefined && { placeholder: spec.placeholder })}
    />
  )
}

// ---- multi -------------------------------------------------------------------------------

function MultiRenderer({
  spec,
  value,
  onChange,
  size,
  className,
}: RendererProps<readonly string[]>): ReactElement {
  const options = optionsOf(spec)
  const t = useMessages(controls)
  if (spec.as === 'segmented') {
    return (
      <Segmented
        multiple
        aria-label={spec.label}
        size={size}
        className={className}
        options={options}
        value={value}
        onValueChange={onChange}
      />
    )
  }
  const labelOf = (v: string): string => options.find((o) => o.value === v)?.label ?? v
  return (
    <Combobox<string, true>
      multiple
      className={className}
      items={options.map((o) => o.value)}
      value={[...value]}
      onValueChange={(next, details) => {
        // Base UI empties a multi combobox on Escape once the list is closed. A close key never
        // unsets an applied filter; the explicit Clear and `Reset all` are the ways to do that.
        if (details.reason === 'escape-key') return
        onChange(next)
      }}
      itemToStringLabel={labelOf}
    >
      <ComboboxChips
        aria-label={spec.label}
        size={size}
        placeholder={spec.placeholder ?? t('controls.any')}
        itemToLabel={labelOf as (value: never) => string}
      />
      <ComboboxContent>
        {(item: string) => (
          <ComboboxItem key={item} value={item}>
            {labelOf(item)}
          </ComboboxItem>
        )}
      </ComboboxContent>
    </Combobox>
  )
}

// ---- string ------------------------------------------------------------------------------

function StringRenderer({
  spec,
  value,
  onChange,
  size,
  className,
}: RendererProps<string>): ReactElement {
  const t = useMessages(controls)
  const field = useCommittedField<string>({ value, empty: '', onCommit: onChange })
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Input
        type={spec.as === 'search' ? 'search' : 'text'}
        aria-label={spec.label}
        size={size}
        value={field.draft}
        onChange={(event) => {
          field.change(event.currentTarget.value)
        }}
        {...field.inputProps}
        {...(spec.placeholder !== undefined && { placeholder: spec.placeholder })}
      />
      {spec.clearable === true && field.draft !== '' && (
        <ClearButton label={t('controls.clear')} clear={field.clearProps} />
      )}
    </div>
  )
}

// ---- number ------------------------------------------------------------------------------

function NumberRenderer({
  spec,
  value,
  onChange,
  onClear,
  size,
  className,
}: RendererProps<number>): ReactElement {
  const t = useMessages(controls)
  const bounds = boundsOf(spec.handle)
  const field = useCommittedField<number | null>({
    value,
    empty: null,
    onCommit: (next) => {
      if (next === null) onClear()
      else onChange(next)
    },
  })
  if (spec.as === 'slider' && bounds.min !== undefined && bounds.max !== undefined) {
    return (
      <Slider
        aria-label={spec.label}
        className={className}
        min={bounds.min}
        max={bounds.max}
        {...(bounds.step !== undefined && { step: bounds.step })}
        value={value}
        onValueChange={(next) => {
          onChange(next)
        }}
      />
    )
  }
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <NumberField
        aria-label={spec.label}
        size={size}
        value={field.draft}
        // `int` is refused by the codec, not rounded: a typed 1.5 would never land and the draft
        // would keep showing it over the stored value, so the input rounds it before it is a draft.
        onValueChange={(next) => {
          field.change(next !== null && bounds.int === true ? Math.round(next) : next)
        }}
        {...(bounds.int === true && { format: { maximumFractionDigits: 0 } })}
        {...(bounds.min !== undefined && { min: bounds.min })}
        {...(bounds.max !== undefined && { max: bounds.max })}
        {...(bounds.step !== undefined && { step: bounds.step })}
        {...(spec.placeholder !== undefined && { placeholder: spec.placeholder })}
        {...field.inputProps}
      />
      {spec.clearable === true && field.draft !== null && (
        <ClearButton label={t('controls.clear')} clear={field.clearProps} />
      )}
    </div>
  )
}

// ---- boolean -----------------------------------------------------------------------------

// A switch and a checkbox have a size of their own: the home's width is for text-like inputs.
function BooleanRenderer({ spec, value, onChange }: RendererProps<boolean>): ReactElement {
  if (spec.as === 'checkbox') {
    return <Checkbox aria-label={spec.label} checked={value} onCheckedChange={onChange} />
  }
  return <Switch aria-label={spec.label} checked={value} onCheckedChange={onChange} />
}

// ---- range -------------------------------------------------------------------------------

type RangeValue = {
  readonly preset: string
  readonly from?: string | undefined
  readonly to?: string | undefined
}

const validDays = (from: string, to: string): boolean => from !== '' && to !== '' && from <= to

function RangeRenderer({
  spec,
  value,
  onChange,
  size,
  className,
}: RendererProps<RangeValue>): ReactElement {
  const options = optionsOf(spec)
  const [picked, setPicked] = useState<string | null>(null)
  const [days, setDays] = useState<{ from: string; to: string }>({
    from: value.from ?? '',
    to: value.to ?? '',
  })
  // A change that did not come from here (a link, back) replaces the local pick and days; our own
  // write lands as the same preset and days, so it changes nothing on screen.
  const [seen, setSeen] = useState(value)
  if (seen.preset !== value.preset || seen.from !== value.from || seen.to !== value.to) {
    setSeen(value)
    setPicked(null)
    setDays({ from: value.from ?? '', to: value.to ?? '' })
  }
  const preset = picked ?? value.preset
  const pick = (next: string): void => {
    if (next === 'custom') {
      setPicked('custom')
      if (validDays(days.from, days.to)) onChange({ preset: 'custom', ...days })
      return
    }
    setPicked(null)
    onChange({ preset: next })
  }
  const editDay = (key: 'from' | 'to', day: string): void => {
    const next = { ...days, [key]: day }
    setDays(next)
    if (validDays(next.from, next.to)) onChange({ preset: 'custom', ...next })
  }
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {spec.as === 'segmented' ? (
        <Segmented
          aria-label={spec.label}
          size={size}
          options={options}
          value={preset}
          onValueChange={pick}
        />
      ) : (
        <Select<string>
          aria-label={spec.label}
          size={size}
          options={options}
          value={preset}
          onValueChange={(next) => {
            if (next !== null) pick(next)
          }}
          className="min-w-32 flex-1"
        />
      )}
      {preset === 'custom' && (
        <div className="flex min-w-0 flex-wrap items-center gap-1" data-slot="range-days">
          <Input
            type="date"
            size={size}
            aria-label={`${spec.label}: from`}
            value={days.from}
            max={days.to === '' ? undefined : days.to}
            onChange={(event) => {
              editDay('from', event.currentTarget.value)
            }}
            className="w-36 min-w-0"
          />
          <Input
            type="date"
            size={size}
            aria-label={`${spec.label}: to`}
            value={days.to}
            min={days.from === '' ? undefined : days.from}
            onChange={(event) => {
              editDay('to', event.currentTarget.value)
            }}
            className="w-36 min-w-0"
          />
        </div>
      )}
    </div>
  )
}

// ---- dispatch ----------------------------------------------------------------------------

/**
 * The renderer of `spec.handle.kind`. The value arrives typed by the handle's `T`, which the kind
 * fixes (enum and string `string`, multi `readonly string[]`, number `number`, boolean `boolean`,
 * range a preset plus optional days), so the casts here restate what the router half guarantees.
 */
export function KindRenderer<T>(props: RendererProps<T>): ReactElement {
  switch (props.spec.handle.kind) {
    case 'enum':
      return <EnumRenderer {...(props as unknown as RendererProps<string>)} />
    case 'multi':
      return <MultiRenderer {...(props as unknown as RendererProps<readonly string[]>)} />
    case 'string':
      return <StringRenderer {...(props as unknown as RendererProps<string>)} />
    case 'number':
      return <NumberRenderer {...(props as unknown as RendererProps<number>)} />
    case 'boolean':
      return <BooleanRenderer {...(props as unknown as RendererProps<boolean>)} />
    case 'range':
      return <RangeRenderer {...(props as unknown as RendererProps<RangeValue>)} />
    default:
      return props.spec.handle.kind satisfies never
  }
}

/** A short text for a value, for the cue's title: the option's label, a range as its preset. */
export function describeValue<T>(spec: FilterSpec<T>, value: T | undefined): string {
  if (value === undefined || value === null) return ''
  const options = optionsOf(spec)
  const label = (v: unknown): string => options.find((o) => o.value === v)?.label ?? String(v)
  if (Array.isArray(value)) return value.length === 0 ? '' : value.map(label).join(', ')
  if (typeof value === 'object') {
    const range = value as unknown as RangeValue
    return range.preset === 'custom' && range.from !== undefined
      ? `${range.from} – ${range.to ?? ''}`
      : label(range.preset)
  }
  return label(value)
}
