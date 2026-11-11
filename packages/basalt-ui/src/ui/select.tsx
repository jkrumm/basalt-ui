import { Select as BaseSelect } from '@base-ui/react/select'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

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
  'flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-ctrl border border-input bg-background text-left text-foreground focus-ring transition-colors data-placeholder:text-faint data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
  {
    variants: {
      size: {
        md: 'h-ctl px-3 text-sm',
        sm: 'h-6 px-2 text-xs',
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
  'max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-ctrl border border-border bg-popover p-1 text-popover-foreground shadow-overlay outline-none',
)

/**
 * The `SelectItem` cva table: one option row. A coarse pointer lifts it to the 44 px floor.
 *
 * @example
 * selectItemVariants()
 */
export const selectItemVariants = cva(
  'relative flex w-full cursor-default items-center justify-between gap-2 rounded-chip px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
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
  'relative block w-full min-w-0 [&_select]:w-full [&_select]:min-w-0 [&_select]:cursor-pointer [&_select]:appearance-none [&_select]:rounded-ctrl [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:text-foreground [&_select]:focus-ring [&_select]:transition-colors [&_select]:aria-invalid:border-bad [&_select]:disabled:cursor-not-allowed [&_select]:disabled:opacity-50 [&_select]:pointer-coarse:min-h-11 [&_select]:pointer-coarse:text-base',
  {
    variants: {
      size: {
        md: '[&_select]:h-ctl [&_select]:pr-8 [&_select]:pl-3 [&_select]:text-sm',
        sm: '[&_select]:h-6 [&_select]:pr-6 [&_select]:pl-2 [&_select]:text-xs',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
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

export type SelectOption<Value = string> = {
  value: Value
  label: ReactNode
  disabled?: boolean
}

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
        options: readonly SelectOption<Value>[]
        /** Shown in the trigger while no value is selected. */
        placeholder?: string
        items?: never
        children?: never
      })
  | (SelectShared<Value> & {
      options?: never
      placeholder?: never
      /** Label lookup for `SelectValue`, so the closed trigger shows a label before the popup has mounted. */
      items?: BaseSelect.Root.Props<Value, false>['items']
      children: ReactNode
    })

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
  const { className, size, options, placeholder, children, items, ...rest } = props
  const {
    'aria-label': label,
    'aria-labelledby': labelledBy,
    ...root
  } = rest as SelectRootProps<Value> & Partial<{ 'aria-label': string; 'aria-labelledby': string }>
  return (
    <div data-slot="select" className={cn(selectVariants(), className)}>
      <BaseSelect.Root<Value, false> {...root} items={options ?? items}>
        {options === undefined ? (
          children
        ) : (
          <>
            <SelectTrigger
              size={size}
              {...(label !== undefined
                ? { 'aria-label': label }
                : { 'aria-labelledby': labelledBy ?? '' })}
            >
              <SelectValue {...(placeholder !== undefined && { placeholder })} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={String(o.value)} value={o.value} disabled={o.disabled ?? false}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </>
        )}
      </BaseSelect.Root>
    </div>
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
  return (
    <BaseSelect.Trigger
      {...props}
      data-slot="select-trigger"
      className={cn(selectTriggerVariants({ size }), className)}
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
  )
}

export type SelectItemProps = Omit<BaseSelect.Item.Props, 'className'> & Layout

/**
 * One option. The selected one carries a check.
 *
 * @example
 * <SelectItem value="a">Alpha</SelectItem>
 */
export function SelectItem({ className, children, ...props }: SelectItemProps): ReactElement {
  return (
    <BaseSelect.Item
      {...props}
      data-slot="select-item"
      className={cn(selectItemVariants(), className)}
    >
      <BaseSelect.ItemText className="truncate">{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator>
        <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </BaseSelect.ItemIndicator>
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
      <BaseSelect.GroupLabel className="px-2 py-1.5 text-xs text-muted-foreground">
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
  children,
  ...props
}: NativeSelectProps): ReactElement {
  return (
    <div data-slot="native-select" className={cn(nativeSelectVariants({ size }), className)}>
      {/* theme-allow raw-form-control — NativeSelect is the primitive that draws the native select; its table styles it */}
      <select {...props}>
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
