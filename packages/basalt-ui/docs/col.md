---
name: col
use when: 'declaring the columns of a v3 data table: each column is a kind (`entity`, `money`, `status`, ...)'
never when: 'the table is static with no sort, filter, page or selection (use `ui/table`), or a cell needs free markup (`custom` is the one counted escape)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# col

The column factory, typed by the row. Call it at module scope; it carries `T` and nothing else.

## Signature

```ts
col<T>(): Col<T>
  returns Col:
    entity(key: KeysOf<T, string>, o?: EntityOptions<T> | undefined): KindColumn<T>
    text(key: KeysOf<T, string>, o?: TextOptions): KindColumn<T>
    number(key: KeysOf<T, number>, o?: NumberOptions): KindColumn<T>
    money(key: KeysOf<T, number>, o: MoneyOptions): KindColumn<T>
    date(key: KeysOf<T, string | number | Date>, o?: DateOptions): KindColumn<T>
    relativeTime(key: KeysOf<T, string | number | Date>, o?: CommonOptions): KindColumn<T>
    status<const O extends string>(key: KeysOf<T, string>, o: StatusOptions<O>): KindColumn<T>
    delta(key: KeysOf<T, number>, o: DeltaOptions): KindColumn<T>
    meter(key: KeysOf<T, number>, o?: MeterOptions): KindColumn<T>
    boolean(key: KeysOf<T, boolean>, o?: BooleanOptions): KindColumn<T>
    spark(id: string, o: SparkOptions<T>): KindColumn<T>
    select(key: KeysOf<T, string>, o: SelectOptions<T>): KindColumn<T>
    actions(actions: readonly RowAction<T>[], o?: { header?: string; }): KindColumn<T>
    custom(id: string, o: CustomOptions<T>): KindColumn<T>
    codec<const M extends Readonly<Record<string, CodecKind>>>(kinds: M, o?: CodecOptions): TableSchema<M>

  EntityOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    href?: (row: T) => string | NavTarget
    icon?: (row: T) => IconComponent
    sub?: (row: T) => string | null
    filter?: "text"
    width?: "content"  // `'content'` sizes the column to its widest loaded value, name or sub line (floor 18ch, cap 40ch), instead of a flexible share of what the other columns leave

  TextOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    filter?: "text"

  NumberOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    footer?: Aggregate
    unit?: string
    digits?: number

  MoneyOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    footer?: Aggregate
    currency: string

  DateOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    style?: DateStyle

  CommonOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column

  StatusOptions<O>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    options: readonly O[]
    labels?: Readonly<Record<O, string>>  // The text of each option in the cell, the phone card and the column filter; the stored value without it
    tone?: (value: O) => Tone  // Receives the closed option union `options` declares, so a `Record<Option, Tone>` indexes without a cast
    filter?: "multi"

  DeltaOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    polarity: "neutral" | "up-good" | "up-bad"
    unit?: string

  MeterOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    max?: number

  BooleanOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    labels?: readonly [string, string]

  SparkOptions<T>:
    header?: string  // Header text
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    label: string
    render: (row: T, box: Box) => ReactNode

  SelectOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    label: (row: T) => string
    options: readonly string[]
    commit: (row: T, value: string) => unknown

  CustomOptions<T>:
    header?: string
    render: (row: T, env: CellEnv) => ReactNode
    sortValue: (row: T) => string | number | null  // Required: the value the column sorts by
    card: CardSlot  // Required: where the column sits in a card
    priority: Priority  // Required: what survives a narrow tier
    width?: number  // Width in `ch`
    align?: Align

  CodecOptions:
    defaults?: Partial<TableRequest>
    prefix?: string
```

`Tone` import from `basalt-ui/cards`: `import type { Tone } from 'basalt-ui/cards'`.

## Example

```tsx
const c = col<Booking>()
const columns = [c.entity('payee', { header: 'Payee' }), c.money('amount', { currency: 'EUR' })]
```
