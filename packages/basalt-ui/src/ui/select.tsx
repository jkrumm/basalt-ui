import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { Select as BaseSelect } from '@base-ui/react/select'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { select } from '../core/messages/select'
import { useMessages } from '../core/messages/use-messages'
import { scopeClass, useControlScope, ControlScopeProvider } from '../core/control-scope'
import { OptionListBody, VIRTUAL_THRESHOLD, useListRoot } from '../core/list/engine'
import { CheckMark, OptionRowBody, groupLabelVariants } from '../core/list/option-row'
import type { RowSize } from '../core/list/option-row'
import { flatOptions, isGroup } from '../core/list/options'
import type { ListVirtual } from '../core/list/engine'
import type { ListItems, ListOption, ListSource } from '../core/list/options'
import { defaultRank } from '../core/list/rank'
import type { RankFn } from '../core/list/rank'

export type {
  ListAvatar,
  ListGroup,
  ListItems,
  ListLoader,
  ListOption,
  ListSource,
} from '../core/list/options'
export type { RankFn, Rankable } from '../core/list/rank'
export type { ListVirtual } from '../core/list/engine'

/**
 * The `Select` cva table: the box a trigger fills. A width class on `Select` sizes the box and the
 * trigger follows; height and display belong to the table.
 *
 * @example
 * selectVariants() // class string for a hand-built wrapper
 */
export const selectVariants = cva('relative block w-full min-w-0')

/**
 * The `SelectTrigger` cva table: the closed control. A coarse pointer gets the 44 px floor and 16 px
 * text (below that iOS Safari zooms the page on focus).
 *
 * @example
 * selectTriggerVariants({ size: 'sm' })
 */
export const selectTriggerVariants = cva(
  'flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-ctrl border border-input bg-background text-left text-foreground focus-ring transition-colors data-placeholder:text-faint data-readonly:cursor-default data-readonly:border-transparent data-readonly:bg-inset data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:text-base',
  {
    variants: {
      size: {
        md: 'h-ctl px-3 text-sm',
        sm: 'h-6 px-2 text-xs pointer-coarse:h-ctl',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/**
 * The `SelectContent` cva table: the popup. It is never taller than the room the browser leaves
 * (`--available-height`), so a long list scrolls inside it instead of past the viewport.
 *
 * @example
 * selectContentVariants()
 */
export const selectContentVariants = cva(
  'max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-ctrl border border-border bg-popover p-1 shadow-overlay outline-none',
)

/**
 * The `SelectItem` cva table: one option row, the same row `Combobox` and the command palette draw,
 * at the control's height. A coarse pointer lifts it to the 44 px floor.
 *
 * @example
 * selectItemVariants({ size: 'sm' })
 */
export const selectItemVariants = cva(
  'relative flex w-full cursor-default items-center rounded-chip text-left outline-none select-none data-highlighted:bg-accent active:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
  {
    variants: {
      size: {
        sm: 'min-h-6 gap-1.5 px-1.5 py-0.5 text-xs',
        md: 'min-h-ctl gap-2 px-2 py-1 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/**
 * The `NativeSelect` cva table: the platform `<select>` drawn like `Input`, for a row-level choice
 * or the OS picker on a phone. It strips the platform chrome (`appearance-none`) and draws its own
 * chevron. Coarse pointers get the 44 px floor and 16 px text.
 *
 * @example
 * nativeSelectVariants({ size: 'sm' })
 */
export const nativeSelectVariants = cva(
  'relative block w-full min-w-0 [&_select]:w-full [&_select]:min-w-0 [&_select]:cursor-pointer [&_select]:appearance-none [&_select]:rounded-ctrl [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:text-foreground [&_select]:focus-ring [&_select]:transition-colors [&_select]:aria-invalid:border-bad [&_select]:disabled:cursor-not-allowed [&_select]:disabled:opacity-50 [&_select]:pointer-coarse:text-base',
  {
    variants: {
      size: {
        md: '[&_select]:h-ctl [&_select]:pr-8 [&_select]:pl-3 [&_select]:text-sm',
        sm: '[&_select]:h-6 [&_select]:pr-6 [&_select]:pl-2 [&_select]:text-xs [&_select]:pointer-coarse:h-ctl',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/**
 * Every `data-slot` the parts form renders, in export order. Read by the generator for `SLOTS`. The
 * `options` form draws the list engine's slots for its rows instead (`option-row`, `option-group`,
 * `option-group-label`, `option-status`) and, when it searches, `select-search`; those are not
 * parts.
 */
export const selectParts = [
  'select',
  'select-trigger',
  'select-value',
  'select-content',
  'select-item',
  'select-group',
  'native-select',
] as const

type Layout = {
  /** Layout only (`w-full`, `w-40`, `flex-1`). Height belongs to `size`. */
  className?: string
}

/** The accessible name a select trigger must carry: a label, or the id of one. */
export type SelectName = { 'aria-label': string } | { 'aria-labelledby': string }

/** One choice: the shared `ListOption` (value, label, description, icon or avatar, keywords, hint). */
export type SelectOption<Value = string> = ListOption<Value>

type SelectRootProps<Value> = Omit<
  BaseSelect.Root.Props<Value, false>,
  'children' | 'items' | 'multiple'
>

type SelectShared<Value> = SelectRootProps<Value> &
  Layout &
  VariantProps<typeof selectTriggerVariants>

/**
 * `Select` takes its choices as `options` (the trigger is built for you and must be named) or as
 * parts (`SelectTrigger`, `SelectContent`, ...); the two forms are a union.
 */
export type SelectProps<Value = string> =
  | (SelectShared<Value> &
      SelectName & {
        /**
         * Options and groups (`{ label, options }`). A loader `(query, { signal }) => Promise<...>`
         * makes the select searchable and asks it for every query.
         */
        options: ListSource<Value>
        /** Shown in the trigger while no value is selected. */
        placeholder?: string
        /**
         * A search field at the top of the open list, ranked with `rank`. On by itself for a loader
         * or more than 100 options, which also window the list.
         */
        searchable?: boolean
        /** Orders and filters the options for the search text. Default `defaultRank`. */
        rank?: RankFn<ListOption<Value>> | undefined
        /** Shown when the search matches nothing. Default the message key `select.empty`. */
        empty?: ReactNode
        /**
         * The windowing port of a searchable list: pass `VirtualList` from
         * `basalt-ui/ui/virtual-list` and past 100 rows only the rows in view mount.
         */
        virtual?: ListVirtual | undefined
        items?: never
        children?: never
      })
  | (SelectShared<Value> & {
      options?: never
      placeholder?: never
      searchable?: never
      rank?: never
      empty?: never
      virtual?: never
      /** Label lookup for `SelectValue`, so the closed trigger shows a label before the popup has mounted. */
      items?: BaseSelect.Root.Props<Value, false>['items']
      children: ReactNode
    })

/** The trigger's view of an option: its icon and label, never the description. */
function TriggerLabel({ option }: { option: Pick<SelectOption, 'label' | 'icon'> }): ReactElement {
  const { icon: Icon, label } = option
  return (
    <span className="flex min-w-0 items-center gap-2">
      {Icon !== undefined && (
        <Icon className="size-icon shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="truncate">{label}</span>
    </span>
  )
}

function Chevron(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-icon shrink-0 text-muted-foreground"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The trigger's label for an option: its icon and label, never the description. */
function triggerItem<Value>(option: SelectOption<Value>): { value: Value; label: ReactNode } {
  if (option.icon === undefined) return { value: option.value, label: option.label }
  return { value: option.value, label: <TriggerLabel option={option} /> }
}

/** One option of the options form: the shared row, its label as the item text. */
function SelectRow<Value>({
  option,
  size,
}: {
  option: SelectOption<Value>
  size: RowSize
}): ReactElement {
  return (
    <BaseSelect.Item
      value={option.value}
      disabled={option.disabled ?? false}
      data-slot="option-row"
      className={selectItemVariants({ size: size === 'sm' ? 'sm' : 'md' })}
    >
      <OptionRowBody
        option={option}
        size={size}
        Text={BaseSelect.ItemText}
        check={<BaseSelect.ItemIndicator render={<CheckMark />} />}
      />
    </BaseSelect.Item>
  )
}

/**
 * A single-choice select on Base UI. Which job, which part: fewer than 10 known values, `Select`;
 * row-level or an OS picker on phones, `NativeSelect`; search, async, multi or 50+ options,
 * `Combobox`; free text with suggestions, `Autocomplete`.
 *
 * Give `options` for the common case, or compose parts when an item has its own layout. The trigger
 * is named by type: pass `aria-label` or `aria-labelledby`. Works with no provider and joins a Base
 * UI `Field` when wrapped in one.
 *
 * @useWhen a person picks one of fewer than 10 known values
 * @neverWhen the list is searchable, async, multi-select or 50 or more options (Combobox)
 *
 * @example
 * <Select aria-label="Stage" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} value={v} onValueChange={setV} />
 */
export function Select<Value = string>(props: SelectProps<Value>): ReactElement {
  const {
    className,
    size,
    options,
    placeholder,
    children,
    items,
    searchable,
    rank,
    empty,
    virtual,
    ...rest
  } = props
  const scope = useControlScope()
  const {
    'aria-label': label,
    'aria-labelledby': labelledBy,
    ...root
  } = rest as SelectRootProps<Value> & Partial<{ 'aria-label': string; 'aria-labelledby': string }>
  const name =
    label !== undefined ? { 'aria-label': label } : { 'aria-labelledby': labelledBy ?? '' }
  const rowSize: RowSize = size ?? scope?.size ?? 'md'
  const searches =
    options !== undefined &&
    (searchable === true ||
      typeof options === 'function' ||
      flatOptions(options).length > VIRTUAL_THRESHOLD)

  if (options !== undefined && searches) {
    return (
      <div data-slot="select" className={cn(selectVariants(), scopeClass(scope), className)}>
        <SearchableSelect
          {...(root as SearchRootProps)}
          naming={name}
          options={options as ListSource<unknown>}
          rank={(rank ?? defaultRank) as RankFn<ListOption<unknown>>}
          size={size ?? scope?.size}
          rowSize={rowSize}
          placeholder={placeholder}
          empty={empty}
          port={virtual}
        />
      </div>
    )
  }
  const flat = options === undefined ? undefined : flatOptions(options as ListItems<Value>)
  return (
    <div data-slot="select" className={cn(selectVariants(), scopeClass(scope), className)}>
      <BaseSelect.Root<Value, false>
        {...root}
        items={flat === undefined ? items : flat.map(triggerItem)}
      >
        {options === undefined || typeof options === 'function' ? (
          children
        ) : (
          <>
            <SelectTrigger size={size} {...name}>
              <SelectValue {...(placeholder !== undefined && { placeholder })} />
            </SelectTrigger>
            <SelectContent>
              {options.map((entry, at) =>
                isGroup(entry) ? (
                  <BaseSelect.Group key={`group:${at}`} data-slot="option-group">
                    <BaseSelect.GroupLabel
                      data-slot="option-group-label"
                      className={groupLabelVariants({ size: rowSize })}
                    >
                      {entry.label}
                    </BaseSelect.GroupLabel>
                    {entry.options.map((option) => (
                      <SelectRow key={String(option.value)} option={option} size={rowSize} />
                    ))}
                  </BaseSelect.Group>
                ) : (
                  <SelectRow key={String(entry.value)} option={entry} size={rowSize} />
                ),
              )}
            </SelectContent>
          </>
        )}
      </BaseSelect.Root>
    </div>
  )
}

/** The root props a searchable select forwards to Base UI's Combobox. */
type SearchRootProps = Pick<
  BaseSelect.Root.Props<unknown, false>,
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'open'
  | 'defaultOpen'
  | 'onOpenChange'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'name'
  | 'id'
  | 'isItemEqualToValue'
>

/**
 * A select with a search field: Base UI's Combobox with the input inside the popup, a trigger drawn
 * as the select's own, and the engine's rows (windowed past 100 when `virtual` is given).
 */
function SearchableSelect({
  naming: label,
  options,
  rank,
  size,
  rowSize,
  placeholder,
  empty,
  port,
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen,
  onOpenChange,
  ...root
}: SearchRootProps & {
  port: ListVirtual | undefined
  naming: { 'aria-label': string } | { 'aria-labelledby': string }
  options: ListSource<unknown>
  rank: RankFn<ListOption<unknown>>
  size: 'md' | 'sm' | null | undefined
  rowSize: RowSize
  placeholder: string | undefined
  empty: ReactNode
}): ReactElement {
  const t = useMessages(select)
  const {
    list,
    highlight,
    selectedIndex,
    virtual,
    root: engine,
  } = useListRoot({
    options,
    rank,
    value,
    defaultValue,
    onValueChange,
    open,
    defaultOpen,
    onOpenChange,
    searchInPopup: true,
    virtual: port,
  })
  const inputName = 'aria-label' in label ? label['aria-label'] : undefined
  return (
    <BaseCombobox.Root<unknown, false>
      {...(root as Omit<BaseCombobox.Root.Props<unknown, false>, 'items'>)}
      {...(engine as Omit<typeof engine, 'multiple'>)}
      autoHighlight
    >
      <BaseCombobox.Trigger
        {...label}
        data-slot="select-trigger"
        className={selectTriggerVariants({ size })}
      >
        <BaseCombobox.Value>
          {(selected: unknown) =>
            selected === null || selected === undefined ? (
              <span className="truncate text-faint">{placeholder}</span>
            ) : (
              <TriggerLabel option={list.find(selected) ?? { label: list.textOf(selected) }} />
            )
          }
        </BaseCombobox.Value>
        <Chevron />
      </BaseCombobox.Trigger>
      <ControlScopeProvider value={null}>
        <BaseCombobox.Portal>
          <BaseCombobox.Positioner sideOffset={4} className="z-50 outline-none">
            <BaseCombobox.Popup
              data-slot="select-content"
              className={cn(
                selectContentVariants(),
                'relative',
                virtual !== undefined && 'overflow-hidden',
              )}
            >
              <BaseCombobox.Input
                {...(inputName !== undefined
                  ? { 'aria-label': inputName }
                  : {
                      'aria-labelledby': (label as { 'aria-labelledby': string })[
                        'aria-labelledby'
                      ],
                    })}
                data-slot="select-search"
                placeholder={t('select.search')}
                className="mb-1 h-ctl w-full rounded-chip border border-input bg-background px-2 text-sm text-foreground focus-ring placeholder:text-faint"
              />
              <OptionListBody
                list={list}
                size={rowSize}
                kind="combobox"
                highlight={highlight}
                virtual={virtual}
                empty={empty}
                selectedIndex={selectedIndex}
              />
            </BaseCombobox.Popup>
          </BaseCombobox.Positioner>
        </BaseCombobox.Portal>
      </ControlScopeProvider>
    </BaseCombobox.Root>
  )
}

export type SelectTriggerProps = Omit<BaseSelect.Trigger.Props, 'className' | 'children'> &
  Layout &
  VariantProps<typeof selectTriggerVariants> &
  SelectName & { children?: ReactNode }

/**
 * The closed control of a parts-form `Select`. It must be named: pass `aria-label` or
 * `aria-labelledby`, or a missing name fails to type-check.
 *
 * @example
 * <SelectTrigger aria-label="Stage"><SelectValue placeholder="Pick one" /></SelectTrigger>
 */
export function SelectTrigger({
  size,
  className,
  children,
  ...props
}: SelectTriggerProps): ReactElement {
  const scope = useControlScope()
  return (
    <BaseSelect.Trigger
      {...props}
      data-slot="select-trigger"
      className={cn(selectTriggerVariants({ size: size ?? scope?.size }), className)}
    >
      {children}
      <BaseSelect.Icon render={<Chevron />} />
    </BaseSelect.Trigger>
  )
}

export type SelectValueProps = Omit<BaseSelect.Value.Props, 'className'> & {
  /** Layout only. */
  className?: string
}

/**
 * The selected value inside the trigger; it shows the item's label, or `placeholder` while empty.
 *
 * @example
 * <SelectValue placeholder="Pick one" />
 */
export function SelectValue({ className, ...props }: SelectValueProps): ReactElement {
  return (
    <BaseSelect.Value {...props} data-slot="select-value" className={cn('truncate', className)} />
  )
}

export type SelectContentProps = Omit<BaseSelect.Popup.Props, 'className'> &
  Layout & {
    /** Where the popup renders. Default `document.body`. */
    container?: BaseSelect.Portal.Props['container']
  }

/**
 * The popup, portalled and positioned by Base UI. It scrolls inside the room left on screen.
 *
 * @example
 * <SelectContent><SelectItem value="a">Alpha</SelectItem></SelectContent>
 */
export function SelectContent({
  className,
  container,
  children,
  ...props
}: SelectContentProps): ReactElement {
  return (
    <ControlScopeProvider value={null}>
      <BaseSelect.Portal {...(container !== undefined && { container })}>
        <BaseSelect.Positioner sideOffset={4} className="z-50 outline-none">
          <BaseSelect.Popup
            {...props}
            data-slot="select-content"
            className={cn(selectContentVariants(), className)}
          >
            <BaseSelect.List>{children}</BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </ControlScopeProvider>
  )
}

export type SelectItemProps = Omit<BaseSelect.Item.Props, 'className'> &
  Layout &
  VariantProps<typeof selectItemVariants>

/**
 * One option. The selected one carries a check.
 *
 * @example
 * <SelectItem value="a">Alpha</SelectItem>
 */
export function SelectItem({ size, className, children, ...props }: SelectItemProps): ReactElement {
  return (
    <BaseSelect.Item
      {...props}
      data-slot="select-item"
      className={cn(selectItemVariants({ size }), className)}
    >
      <BaseSelect.ItemText className="min-w-0 flex-1 truncate">{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator render={<CheckMark />} />
    </BaseSelect.Item>
  )
}

export type SelectGroupProps = Omit<BaseSelect.Group.Props, 'className'> &
  Layout & {
    /** The group heading; it names the group for assistive tech. */
    label: ReactNode
  }

/**
 * A labelled run of items.
 *
 * @example
 * <SelectGroup label="Europe"><SelectItem value="de">Germany</SelectItem></SelectGroup>
 */
export function SelectGroup({
  className,
  label,
  children,
  ...props
}: SelectGroupProps): ReactElement {
  return (
    <BaseSelect.Group {...props} data-slot="select-group" className={className}>
      <BaseSelect.GroupLabel className={groupLabelVariants({ size: 'md' })}>
        {label}
      </BaseSelect.GroupLabel>
      {children}
    </BaseSelect.Group>
  )
}

export type NativeSelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'className' | 'size'> &
  Layout &
  VariantProps<typeof nativeSelectVariants> & {
    /** The choices; omit it to write `<option>` children. */
    options?: readonly SelectOption<string>[]
    /** Fires with the picked value, so a form field's value writer takes it. `onChange` still fires. */
    onValueChange?: (value: string) => void
  }

/**
 * The platform `<select>` with the design's box and chevron: appearance stripped, height from
 * `size`, focus ring, 16 px text on a coarse pointer. Use it for a row-level choice or where the OS
 * picker is the better phone UI. Name it with a wrapping `<label>` or `aria-label`.
 *
 * @useWhen a row-level choice, or the OS picker beats a popup on a phone
 * @neverWhen options need their own layout (Select)
 *
 * @example
 * <NativeSelect aria-label="Status" value={v} onChange={(e) => setV(e.target.value)} options={options} />
 */
export function NativeSelect({
  size,
  className,
  options,
  onValueChange,
  onChange,
  children,
  ...props
}: NativeSelectProps): ReactElement {
  const scope = useControlScope()
  return (
    <div
      data-slot="native-select"
      className={cn(
        nativeSelectVariants({ size: size ?? scope?.size }),
        scopeClass(scope),
        className,
      )}
    >
      <select
        {...props}
        onChange={(event) => {
          onChange?.(event)
          onValueChange?.(event.target.value)
        }}
      >
        {options === undefined
          ? children
          : options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled ?? false}>
                {o.label}
              </option>
            ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <Chevron />
      </span>
    </div>
  )
}
