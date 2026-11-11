import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete'
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { createContext, useCallback, useContext, useRef } from 'react'
import type { ReactElement, ReactNode, Ref } from 'react'
import { cn } from '../core/cn'
import { select } from '../core/messages/select'
import { useMessages } from '../core/messages/use-messages'

/**
 * The `Combobox` cva table: the box the input fills and the popup anchors to. A width class on
 * `Combobox` sizes the box; height and display belong to the table.
 *
 * @example
 * comboboxVariants() // class string for a hand-built wrapper
 */
export const comboboxVariants = cva('relative block w-full min-w-0')

/**
 * The `ComboboxInput` cva table: the visible input box. A coarse pointer gets the 44 px floor and
 * 16 px text (below that iOS Safari zooms the page on focus).
 *
 * @example
 * comboboxInputVariants({ size: 'sm' })
 */
export const comboboxInputVariants = cva(
  'flex w-full min-w-0 items-center gap-2 rounded-ctrl border border-input bg-background text-foreground transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-focus-visible:outline-solid data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:outline-none [&_input]:placeholder:text-faint',
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
 * The `ComboboxContent` cva table: the popup. It is never taller than the room the browser leaves
 * (`--available-height`), so a long list scrolls inside it.
 *
 * @example
 * comboboxContentVariants()
 */
export const comboboxContentVariants = cva(
  'max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-ctrl border border-border bg-popover p-1 text-popover-foreground shadow-overlay outline-none',
)

/**
 * The `ComboboxItem` cva table: one option row. A coarse pointer lifts it to the 44 px floor.
 *
 * @example
 * comboboxItemVariants()
 */
export const comboboxItemVariants = cva(
  'relative flex w-full cursor-default items-center justify-between gap-2 rounded-chip px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
)

/**
 * The `ComboboxChips` cva table: the box a multi-select draws its chips and input in. Chips wrap
 * and the box grows with them (`min-h`, not `h`).
 *
 * @example
 * comboboxChipsVariants({ size: 'sm' })
 */
export const comboboxChipsVariants = cva(
  'flex w-full min-w-0 flex-wrap items-center gap-1 rounded-ctrl border border-input bg-background text-foreground transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-focus-visible:outline-solid data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base [&_input]:min-w-16 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:outline-none [&_input]:placeholder:text-faint',
  {
    variants: {
      size: {
        md: 'min-h-ctl px-2 py-1 text-sm',
        sm: 'min-h-6 px-1.5 py-0.5 text-xs',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/**
 * The `ComboboxChip` cva table: one selected value with its remove button.
 *
 * @example
 * comboboxChipVariants()
 */
export const comboboxChipVariants = cva(
  'inline-flex h-5 max-w-full items-center gap-1 rounded-chip bg-accent pr-0.5 pl-2 text-xs text-foreground data-highlighted:outline-2 data-highlighted:outline-brand',
)

/**
 * The `Autocomplete` cva table: the box the input fills and the popup anchors to.
 *
 * @example
 * autocompleteVariants()
 */
export const autocompleteVariants = cva('relative block w-full min-w-0')

/**
 * The `AutocompleteInput` cva table: the visible input box, as `ComboboxInput`.
 *
 * @example
 * autocompleteInputVariants({ size: 'sm' })
 */
export const autocompleteInputVariants = cva(
  'flex w-full min-w-0 items-center gap-2 rounded-ctrl border border-input bg-background text-foreground transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-focus-visible:outline-solid data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:outline-none [&_input]:placeholder:text-faint',
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
 * The `AutocompleteContent` cva table: the popup, as `ComboboxContent`.
 *
 * @example
 * autocompleteContentVariants()
 */
export const autocompleteContentVariants = cva(
  'max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-ctrl border border-border bg-popover p-1 text-popover-foreground shadow-overlay outline-none',
)

/**
 * The `AutocompleteItem` cva table: one suggestion row.
 *
 * @example
 * autocompleteItemVariants()
 */
export const autocompleteItemVariants = cva(
  'relative flex w-full cursor-default items-center gap-2 rounded-chip px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const comboboxParts = [
  'combobox',
  'combobox-input',
  'combobox-content',
  'combobox-item',
  'combobox-chips',
  'combobox-chip',
  'autocomplete',
  'autocomplete-input',
  'autocomplete-content',
  'autocomplete-item',
] as const

type Layout = {
  /** Layout only (`w-full`, `w-64`, `flex-1`). Height belongs to `size`. */
  className?: string
}

/** The popup anchors to the whole field box (input or chips), and its width follows it. */
const AnchorContext = createContext<Ref<HTMLDivElement> | undefined>(undefined)

/**
 * Base UI hardcodes `aria-label="Dismiss"` on the two hidden buttons that close an open combobox
 * and offers no prop for it (spike Q4). The wrapper rewrites the attribute on the nodes it owns,
 * now and on every mount, before paint. Drop this when Base UI ships a localisation prop.
 */
function relabel(root: Element, text: string): void {
  if (text === 'Dismiss') return
  for (const node of root.querySelectorAll('[aria-label="Dismiss"]')) {
    node.setAttribute('aria-label', text)
  }
}

function useDismissRef(): (node: HTMLElement | null) => (() => void) | undefined {
  const text = useMessages(select)('combobox.dismiss')
  return useCallback(
    (node) => {
      if (node === null) return undefined
      relabel(node, text)
      const observer = new MutationObserver(() => relabel(node, text))
      observer.observe(node, { childList: true, subtree: true })
      return () => observer.disconnect()
    },
    [text],
  )
}

function Field({
  slot,
  table,
  className,
  children,
}: {
  slot: string
  table: string
  className: string | undefined
  children: ReactNode
}): ReactElement {
  const dismiss = useDismissRef()
  const anchor = useRef<HTMLDivElement | null>(null)
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      anchor.current = node
      return dismiss(node)
    },
    [dismiss],
  )
  return (
    <div data-slot={slot} className={cn(table, className)} ref={ref}>
      <AnchorContext value={anchor}>{children}</AnchorContext>
    </div>
  )
}

export type ComboboxProps<Value = string, Multiple extends boolean | undefined = false> = Omit<
  BaseCombobox.Root.Props<Value, Multiple>,
  'children'
> &
  Layout & { children?: ReactNode }

/**
 * A searchable select on Base UI. Which job, which part: fewer than 10 known values, `Select`;
 * search, async, multi or 50+ options, `Combobox`; free text with suggestions, `Autocomplete`.
 *
 * Pass `items` (strings, or objects with `label` and `value`) and compose `ComboboxInput` and
 * `ComboboxContent`; `multiple` with `ComboboxChips` selects several. The hidden close buttons are
 * named from the message key `combobox.dismiss`. Works with no provider and joins a Base UI `Field`
 * when wrapped in one. No virtualisation here.
 *
 * @useWhen search, async or multi-select, or 50 or more options
 * @neverWhen fewer than 10 known values (Select) or free text (Autocomplete)
 *
 * @example
 * <Combobox items={countries} value={v} onValueChange={setV}>
 *   <ComboboxInput aria-label="Country" placeholder="Search" />
 *   <ComboboxContent empty="No results">
 *     {(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}
 *   </ComboboxContent>
 * </Combobox>
 */
export function Combobox<Value = string, Multiple extends boolean | undefined = false>({
  className,
  children,
  ...props
}: ComboboxProps<Value, Multiple>): ReactElement {
  return (
    <Field slot="combobox" table={comboboxVariants()} className={className}>
      <BaseCombobox.Root<Value, Multiple> {...props}>{children}</BaseCombobox.Root>
    </Field>
  )
}

export type ComboboxInputProps = Omit<BaseCombobox.Input.Props, 'className' | 'size'> &
  Layout &
  VariantProps<typeof comboboxInputVariants> & { 'aria-label': string }

/**
 * The input box of a single-value `Combobox`. It must be named with `aria-label`.
 *
 * @example
 * <ComboboxInput aria-label="Country" placeholder="Search" />
 */
export function ComboboxInput({ size, className, ...props }: ComboboxInputProps): ReactElement {
  return (
    <BaseCombobox.InputGroup
      data-slot="combobox-input"
      className={cn(comboboxInputVariants({ size }), className)}
    >
      <BaseCombobox.Input {...props} />
    </BaseCombobox.InputGroup>
  )
}

export type ComboboxContentProps = Omit<BaseCombobox.Popup.Props, 'className' | 'children'> &
  Layout & {
    /** Rendered in place of the list while nothing matches. */
    empty?: ReactNode
    /** Where the popup renders. Default `document.body`. */
    container?: BaseCombobox.Portal.Props['container']
    /** Items, or a function from an item to its `ComboboxItem`. */
    children?: ReactNode | ((item: never, index: number) => ReactNode)
  }

/**
 * The popup, portalled and anchored to the field. It lists the items that match the input and
 * scrolls inside the room left on screen.
 *
 * @example
 * <ComboboxContent empty="No results">{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxContent>
 */
export function ComboboxContent({
  className,
  empty,
  container,
  children,
  ...props
}: ComboboxContentProps): ReactElement {
  const anchor = useContext(AnchorContext)
  const dismiss = useDismissRef()
  return (
    <BaseCombobox.Portal {...(container !== undefined && { container })}>
      <BaseCombobox.Positioner
        sideOffset={4}
        className="z-50 outline-none"
        ref={dismiss}
        {...(anchor !== undefined && { anchor: anchor as never })}
      >
        <BaseCombobox.Popup
          {...props}
          data-slot="combobox-content"
          className={cn(comboboxContentVariants(), className)}
        >
          {empty !== undefined && (
            <BaseCombobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
              {empty}
            </BaseCombobox.Empty>
          )}
          <BaseCombobox.List>{children as ReactNode}</BaseCombobox.List>
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}

export type ComboboxItemProps = Omit<BaseCombobox.Item.Props, 'className'> & Layout

/**
 * One option. The selected one carries a check.
 *
 * @example
 * <ComboboxItem value="de">Germany</ComboboxItem>
 */
export function ComboboxItem({ className, children, ...props }: ComboboxItemProps): ReactElement {
  return (
    <BaseCombobox.Item
      {...props}
      data-slot="combobox-item"
      className={cn(comboboxItemVariants(), className)}
    >
      <span className="truncate">{children}</span>
      <BaseCombobox.ItemIndicator>
        <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </BaseCombobox.ItemIndicator>
    </BaseCombobox.Item>
  )
}

export type ComboboxChipsProps = Omit<BaseCombobox.Chips.Props, 'className' | 'children'> &
  Layout &
  VariantProps<typeof comboboxChipsVariants> & {
    /** Names the input. */
    'aria-label': string
    placeholder?: string
    /** The text of a selected value, for the chip and its remove name. Default `String(value)`. */
    itemToLabel?: (value: never) => string
  }

/**
 * The input box of a `multiple` `Combobox`: the selected values as removable chips, then the input.
 * The remove buttons are named from the message key `combobox.remove`.
 *
 * @example
 * <Combobox multiple items={tags} value={v} onValueChange={setV}>
 *   <ComboboxChips aria-label="Tags" placeholder="Add a tag" />
 *   <ComboboxContent>...</ComboboxContent>
 * </Combobox>
 */
export function ComboboxChips({
  size,
  className,
  itemToLabel,
  placeholder,
  'aria-label': label,
  ...props
}: ComboboxChipsProps): ReactElement {
  const text = (value: unknown): string =>
    (itemToLabel as ((v: unknown) => string) | undefined)?.(value) ?? String(value)
  return (
    <BaseCombobox.Chips
      {...props}
      data-slot="combobox-chips"
      className={cn(comboboxChipsVariants({ size }), className)}
    >
      <BaseCombobox.Value>
        {(values: readonly unknown[]) => (
          <>
            {values.map((value) => (
              <ComboboxChip key={text(value)} label={text(value)} />
            ))}
            <BaseCombobox.Input
              aria-label={label}
              {...(placeholder !== undefined && { placeholder })}
            />
          </>
        )}
      </BaseCombobox.Value>
    </BaseCombobox.Chips>
  )
}

export type ComboboxChipProps = Omit<BaseCombobox.Chip.Props, 'className' | 'children'> &
  Layout & {
    /** The chip's text, also the name of its remove button. */
    label?: string
  }

/**
 * One selected value of a `multiple` `Combobox`, with a remove button. `ComboboxChips` renders
 * these; use it directly only for a custom chips row.
 *
 * @example
 * <ComboboxChip label="Design" />
 */
export function ComboboxChip({ className, label = '', ...props }: ComboboxChipProps): ReactElement {
  const t = useMessages(select)
  return (
    <BaseCombobox.Chip
      {...props}
      data-slot="combobox-chip"
      className={cn(comboboxChipVariants(), className)}
    >
      <span className="truncate">{label}</span>
      <BaseCombobox.ChipRemove
        aria-label={t('combobox.remove', label)}
        className="inline-flex size-4 cursor-pointer items-center justify-center rounded-chip text-muted-foreground hover:bg-selected pointer-coarse:after:absolute pointer-coarse:after:size-11"
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </BaseCombobox.ChipRemove>
    </BaseCombobox.Chip>
  )
}

export type AutocompleteProps<Item = string> = Omit<
  BaseAutocomplete.Root.Props<Item>,
  'children' | 'items'
> &
  Layout & { items?: readonly Item[]; children?: ReactNode }

/**
 * Free text with suggestions on Base UI: the input keeps what is typed, the popup suggests. It is
 * also the command-palette base. For a value that must come from the list use `Combobox`.
 *
 * @useWhen free text with suggestions, or a command palette
 * @neverWhen the value must be one of the options (Combobox)
 *
 * @example
 * <Autocomplete items={cities} value={q} onValueChange={setQ}>
 *   <AutocompleteInput aria-label="City" />
 *   <AutocompleteContent empty="No suggestions">
 *     {(item) => <AutocompleteItem key={item} value={item}>{item}</AutocompleteItem>}
 *   </AutocompleteContent>
 * </Autocomplete>
 */
export function Autocomplete<Item = string>({
  className,
  children,
  items,
  ...props
}: AutocompleteProps<Item>): ReactElement {
  return (
    <Field slot="autocomplete" table={autocompleteVariants()} className={className}>
      <BaseAutocomplete.Root<Item> {...props} {...(items !== undefined && { items })}>
        {children}
      </BaseAutocomplete.Root>
    </Field>
  )
}

export type AutocompleteInputProps = Omit<BaseCombobox.Input.Props, 'className' | 'size'> &
  Layout &
  VariantProps<typeof autocompleteInputVariants> & { 'aria-label': string }

/**
 * The input box of an `Autocomplete`. It must be named with `aria-label`.
 *
 * @example
 * <AutocompleteInput aria-label="City" placeholder="Search" />
 */
export function AutocompleteInput({
  size,
  className,
  ...props
}: AutocompleteInputProps): ReactElement {
  return (
    <BaseAutocomplete.InputGroup
      data-slot="autocomplete-input"
      className={cn(autocompleteInputVariants({ size }), className)}
    >
      <BaseAutocomplete.Input {...props} />
    </BaseAutocomplete.InputGroup>
  )
}

export type AutocompleteContentProps = Omit<
  BaseAutocomplete.Popup.Props,
  'className' | 'children'
> &
  Layout & {
    empty?: ReactNode
    container?: BaseAutocomplete.Portal.Props['container']
    children?: ReactNode | ((item: never, index: number) => ReactNode)
  }

/**
 * The suggestion popup, portalled and anchored to the field.
 *
 * @example
 * <AutocompleteContent empty="No suggestions">{(item) => <AutocompleteItem key={item} value={item}>{item}</AutocompleteItem>}</AutocompleteContent>
 */
export function AutocompleteContent({
  className,
  empty,
  container,
  children,
  ...props
}: AutocompleteContentProps): ReactElement {
  const anchor = useContext(AnchorContext)
  const dismiss = useDismissRef()
  return (
    <BaseAutocomplete.Portal {...(container !== undefined && { container })}>
      <BaseAutocomplete.Positioner
        sideOffset={4}
        className="z-50 outline-none"
        ref={dismiss}
        {...(anchor !== undefined && { anchor: anchor as never })}
      >
        <BaseAutocomplete.Popup
          {...props}
          data-slot="autocomplete-content"
          className={cn(autocompleteContentVariants(), className)}
        >
          {empty !== undefined && (
            <BaseAutocomplete.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
              {empty}
            </BaseAutocomplete.Empty>
          )}
          <BaseAutocomplete.List>{children as ReactNode}</BaseAutocomplete.List>
        </BaseAutocomplete.Popup>
      </BaseAutocomplete.Positioner>
    </BaseAutocomplete.Portal>
  )
}

export type AutocompleteItemProps = Omit<BaseAutocomplete.Item.Props, 'className'> & Layout

/**
 * One suggestion.
 *
 * @example
 * <AutocompleteItem value="Berlin">Berlin</AutocompleteItem>
 */
export function AutocompleteItem({ className, ...props }: AutocompleteItemProps): ReactElement {
  return (
    <BaseAutocomplete.Item
      {...props}
      data-slot="autocomplete-item"
      className={cn(autocompleteItemVariants(), className)}
    />
  )
}
