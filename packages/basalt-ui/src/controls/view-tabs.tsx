/**
 * `ViewTabs`: the page's or section's view switch, bound to a `ControlHandle`. A tab is store state
 * like any filter, so it takes `handle` and never `value` or `onChange`: a deep link renders the tab
 * the link names in the server HTML, and Back returns to the tab the visitor left.
 *
 * The swap between the two forms is CSS, one mount each, never a JS media query (which would paint
 * differently on the server and on the first client frame). From `md` up (840 px) the switch is a tab strip
 * (`ui/tabs`); below it a full-width track (`ui/segmented`) for three options or fewer, a `Select`
 * past that. Inside a `row` home (`<ControlHome home="aside">`) it is a panel row: the label above
 * one full-width track or `Select`, and every declared option is offered.
 *
 * `ViewTabsOption.only` declares a tab that exists on ONE form (the names are the brief's; the swap is `md`): `'sm-up'` keeps it off the phone
 * form, `'sm-down'` keeps it off the strip. A row is one width, so `only` does not apply there.
 */
import { use, useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { ControlHandle } from '../core/ports'
import { Segmented } from '../ui/segmented'
import { Select } from '../ui/select'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import type { ViewTabsProps as ContractProps } from './contract'
import { ControlPresentationContext } from './control-view'
import { LegacyViewTabs } from './view-tabs-legacy'
import type { LegacyViewTabsProps } from './view-tabs-legacy'

export type ViewTabsOption<T extends string = string> = {
  readonly value: T
  readonly label: string
  readonly disabled?: boolean
  /** Render this option on ONE viewport only. Omitted: both. */
  readonly only?: 'sm-up' | 'sm-down'
}

type HandleProps<T extends string> = ContractProps<T> & {
  /** Defaults to `handle.options` (every declared value, labelled by `.labels()`). */
  options?: readonly ViewTabsOption<T>[]
  /**
   * The switch's accessible name; both forms carry it. Pass a translated string when the app is not
   * English.
   *
   * @default 'View'
   */
  label?: string
  disabled?: boolean
  /** Layout only (`w-full`, `ml-auto`). */
  className?: string
  field?: never
  value?: never
  onChange?: never
  size?: never
}

/** The 2.x `field` form stays while 2.x pages compose it; it moves to `handle` with them. */
export type ViewTabsProps<T extends string = string> =
  | HandleProps<T>
  | (LegacyViewTabsProps<T> & { handle?: never })

/** Past three options the narrow form is a `Select`, not a track. */
const TRACK_MAX = 3

function optionsOf<T extends string>(
  handle: ControlHandle<T>,
  options: readonly ViewTabsOption<T>[] | undefined,
): readonly ViewTabsOption<T>[] {
  return options ?? (handle.options ?? []).map((o) => ({ value: o.value, label: o.label }))
}

type Name = { 'aria-label': string } | { 'aria-labelledby': string }

/** The full-width form: a track for few options, a `Select` for many. */
function NarrowForm<T extends string>({
  options,
  value,
  onChange,
  name,
  disabled,
  size,
}: {
  options: readonly ViewTabsOption<T>[]
  value: T
  onChange(next: T): void
  name: Name
  disabled: boolean
  size: 'sm' | 'md'
}): ReactElement {
  if (options.length <= TRACK_MAX) {
    return (
      <Segmented
        {...name}
        size={size}
        disabled={disabled}
        className="w-full"
        options={options}
        value={value}
        onValueChange={(next) => {
          onChange(next as T)
        }}
      />
    )
  }
  return (
    <Select<string>
      {...name}
      size={size}
      disabled={disabled}
      options={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T)
      }}
    />
  )
}

function HandleViewTabs<T extends string>({
  handle,
  options,
  label = 'View',
  disabled = false,
  className,
}: HandleProps<T>): ReactElement {
  const presentation = use(ControlPresentationContext)
  const labelId = useId()
  const [value, set] = handle.use()
  const all = optionsOf(handle, options)
  const size = presentation === 'inline' ? 'sm' : 'md'
  const commit = (next: T): void => {
    set(next)
  }

  if (presentation === 'row') {
    return (
      <div
        data-slot="view-tabs"
        data-presentation="row"
        className={cn('flex w-full min-w-0 flex-col gap-1.5', className)}
      >
        <span id={labelId} className="text-sm font-medium text-foreground">
          {label}
        </span>
        <NarrowForm
          options={all}
          value={value}
          onChange={commit}
          name={{ 'aria-labelledby': labelId }}
          disabled={disabled}
          size={size}
        />
      </div>
    )
  }

  const strip = all.filter((o) => o.only !== 'sm-down')
  const narrow = all.filter((o) => o.only !== 'sm-up')
  return (
    <div
      data-slot="view-tabs"
      data-presentation={presentation}
      className={cn('flex min-w-0 max-w-full flex-col', className)}
    >
      <Tabs
        size={size}
        value={value}
        className="max-md:hidden"
        onValueChange={(next) => {
          commit(next as T)
        }}
      >
        <TabsList aria-label={label}>
          {strip.map((o) => (
            <TabsTrigger key={o.value} value={o.value} disabled={disabled || o.disabled === true}>
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="w-full min-w-0 md:hidden">
        <NarrowForm
          options={narrow}
          value={value}
          onChange={commit}
          name={{ 'aria-label': label }}
          disabled={disabled}
          size={size}
        />
      </div>
    </div>
  )
}

/**
 * The view switch of a page or a section, bound to a `handle`. The URL (or any lane) owns the
 * value: a link with `?tab=history` renders History on the first server pass, and Back walks the
 * tabs when the field is `history: 'push'`. One mount per form, swapped in CSS at `md`.
 *
 * @useWhen a page or section has a few views of the same data and the visitor must be able to link to one
 * @neverWhen the choice filters rows (use a `spec` in a `FilterSet`) or is a list of sections beside the page (use `InnerNav`)
 *
 * @example
 * <ViewTabs
 *   handle={overview.field.tab}
 *   label="Overview view"
 *   options={[
 *     { value: 'all', label: 'All' },
 *     { value: 'errors', label: 'Errors' },
 *     { value: 'train', label: 'Train', only: 'sm-down' },
 *   ]}
 * />
 */
export function ViewTabs<T extends string>(props: ViewTabsProps<T>): ReactNode {
  if (props.handle !== undefined) return <HandleViewTabs {...props} />
  return <LegacyViewTabs {...(props as LegacyViewTabsProps<T>)} />
}
