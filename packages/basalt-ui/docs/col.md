---
name: col
use when: 'declaring the columns of a v3 data table: each column is a kind (`entity`, `money`, `status`, ...)'
never when: 'the table is static with no sort, filter, page or selection (use `ui/table`), or a cell needs free markup (`custom` is the one counted escape)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# col

The column factory, typed by the row. Call it at module scope; it carries `T` and nothing else. The
column plan is silent in a production build, so know its three rules: more than two priority 1 columns
demote to 2 by declaration order, the identity column first; a visible width sum above 1800 px stays
reduced, so priority 3 never shows; and above 800 px of priority 1 and 2 the trailing priority 2
columns demote to 3. Dev builds warn; `basalt-ui shot detect` names a column hidden at 1800 px or
missing from every phone card (`craft-6/hidden-column`).

## Signature

```ts
col<T>(): Col<T>
  returns Col:
    entity(key: KeysOf<T, string>, o?: EntityOptions<T> | undefined): KindColumn<T>
    title<const K extends string>(key: KeysOf<T, string>, o: TitleOptions<T, K>): KindColumn<T>
    person(key: KeysOf<T, string>, o?: PersonOptions<T> | undefined): KindColumn<T>
    people(key: KeysOf<T, readonly string[]>, o?: PeopleOptions<T> | undefined): KindColumn<T>
    tags(key: KeysOf<T, readonly string[]>, o?: TagsOptions): KindColumn<T>
    countdown(key: KeysOf<T, string | number | Date>, o?: CountdownOptions): KindColumn<T>
    link(key: KeysOf<T, string>, o?: LinkOptions<T> | undefined): KindColumn<T>
    text(key: KeysOf<T, string>, o?: TextOptions): KindColumn<T>
    number(key: KeysOf<T, number>, o?: NumberOptions<T> | undefined): KindColumn<T>
    money(key: KeysOf<T, number>, o: MoneyOptions): KindColumn<T>
    date(key: KeysOf<T, string | number | Date>, o?: DateOptions<T> | undefined): KindColumn<T>
    relativeTime(key: KeysOf<T, string | number | Date>, o?: RelativeTimeOptions<T> | undefined): KindColumn<T>
    status<const O extends string>(key: KeysOf<T, string>, o: StatusOptions<O, T>): KindColumn<T>
    delta(key: KeysOf<T, number>, o: DeltaOptions): KindColumn<T>
    meter(key: KeysOf<T, number>, o?: MeterOptions<T> | undefined): KindColumn<T>
    boolean(key: KeysOf<T, boolean>, o?: BooleanOptions<T> | undefined): KindColumn<T>
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
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    href?: (row: T) => string | NavTarget
    icon?: (row: T) => IconComponent
    image?: (row: T) => string | null  // A logo or photo URL drawn as a 16 px face before the name (initials while it loads or when absent); wins over `icon`
    imageShape?: "object" | "person"  // `'object'` (default) is a rounded square for a company or logo; `'person'` a circle
    ref?: (row: T) => string | null  // A short reference (`INV-0042`) in muted mono beside the name
    sub?: (row: T) => string | null
    mono?: boolean  // The name is a time or an id: drawn in the mono face with tabular numerals
    subMono?: boolean  // The secondary text is a time or an id: drawn in the mono face with tabular numerals
    filter?: "text"
    width?: "content"  // `'content'` sizes the column to its widest loaded value, name or sub line (floor 18ch, cap 40ch), instead of a flexible share of what the other columns leave

  TitleOptions<T, K>:
    filter?: "text"
    id?: string  // Column id when it differs from the key (two columns over one field)
    header?: string  // Header text
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    href?: (row: T) => string | NavTarget
    imageShape?: "object" | "person"  // `'object'` (default) is a rounded square for a company or logo; `'person'` a circle
    ref?: (row: T) => string | null  // A short reference (`INV-0042`) in muted mono beside the name
    sub?: (row: T) => string | null
    mono?: boolean  // The name is a time or an id: drawn in the mono face with tabular numerals
    subMono?: boolean  // The secondary text is a time or an id: drawn in the mono face with tabular numerals
    width?: "content"  // `'content'` sizes the column to its widest loaded value, name or sub line (floor 18ch, cap 40ch), instead of a flexible share of what the other columns leave
    type: (row: T) => K
    icons: Readonly<Record<K, IconComponent>>

  PersonOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    avatar?: (row: T) => string | null  // The face's image URL; initials show while it loads or when absent
    role?: (row: T) => string | null  // Muted text after the name: a job title, a team
    href?: (row: T) => string | NavTarget
    filter?: "multi"  // `'multi'` filters by a checklist of the names the rows hold

  PeopleOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    avatar?: (name: string, row: T) => string | null  // The face's image URL of one name
    max?: number  // Faces shown before the `+N`
    filter?: "multi"

  TagsOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    labels?: Readonly<Record<string, string>>  // The text of a stored tag; the tag itself without an entry
    tone?: (tag: string) => Tone  // The chip's tone, from the status tone map
    filter?: "multi"  // `'multi'` filters by a checklist of the tags the rows hold; a row passes on any of its tags

  CountdownOptions:
    // either filter + picker or neither
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    filter?: "range"
    picker?: DateRangeLike
    bad?: number
    warn?: number
    horizon?: number

  LinkOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    href?: (row: T) => string | NavTarget  // A record link or in-app path; without it the value's own URL or address is the destination
    label?: (row: T) => string | null  // What is printed for the row; without it the value minus its scheme
    icon?: (row: T) => IconComponent
    filter?: "text"

  TextOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    filter?: "text"
    labels?: Readonly<Record<string, string>>  // The text of a stored value in the cell and the phone card; the stored value without an entry
    quiet?: boolean  // A muted one-line preview: secondary ink, truncated, never wrapped

  NumberOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    footer?: Aggregate
    filter?: "range"
    bounds?: readonly [number, number]
    age?: { at: (row: T) => string | number | Date | null | undefined; label?: string; }
    unit?: string
    digits?: number
    duration?: "ms" | "s"  // The value is a span in this unit, written in its one largest unit: `30 min`, `1.4 hr`, `2 days`
    trend?: TrendOption<T>
    of?: (row: T) => number | null  // The whole the value is a part of: the cell writes `11/12`, sorts and range-filters by the share (0 to 1), and takes no `footer`
    warnBelow?: number  // With `of`: a share below this is drawn in the warn ink (`1`: anything under full)
    badBelow?: number  // With `of`: a share below this is drawn in the bad ink

  MoneyOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    footer?: Aggregate
    filter?: "range"
    bounds?: readonly [number, number]
    currency: string
    digits?: number  // Fraction digits of the figure (`0` writes whole euros); default: the currency's own (2 for EUR, 0 for JPY)

  DateOptions<T>:
    // either filter + picker or neither
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    filter?: "range"
    picker?: DateRangeLike
    icon?: (row: T) => IconComponent  // The cell's icon for this row: a status icon replaces the dot, a boolean icon the check or cross
    style?: DateStyle
    mono?: boolean  // The date is an id-like time: drawn in the mono face with tabular numerals, in the cell and on its phone card line

  RelativeTimeOptions<T>:
    // either filter + picker or neither
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    filter?: "range"
    picker?: DateRangeLike
    icon?: (row: T) => IconComponent  // The cell's icon for this row: a status icon replaces the dot, a boolean icon the check or cross
    mono?: boolean  // The relative time is a time: drawn in the mono face with tabular numerals, in the cell and on its phone card line

  StatusOptions<O, T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    icon?: (row: T) => IconComponent  // The cell's icon for this row: a status icon replaces the dot, a boolean icon the check or cross
    options: readonly O[]
    labels?: Readonly<Record<O, string>>  // The text of each option in the cell, the phone card and the column filter; the stored value without it
    tone?: (value: O) => Tone  // Receives the closed option union `options` declares, so a `Record<Option, Tone>` indexes without a cast
    filter?: "multi"  // `'multi'` filters by a checklist of the options; the user can also rank them from the header
    lamp?: boolean  // The toned dot alone, its word for assistive tech and on hover: a column of states read by colour at a glance
    age?: { at: (row: T) => string | number | Date | null | undefined; label?: string; }

  DeltaOptions:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    filter?: "range"
    bounds?: readonly [number, number]
    polarity: "neutral" | "up-good" | "up-bad"
    unit?: string
    currency?: string  // A money change: `+€50.00` in the currency's own digits, like `c.money`; wins over `unit`

  MeterOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    max?: number | ((row: T) => number | null | undefined)
    segments?: readonly MeterSegment<T>[]
    fraction?: boolean
    filter?: "range"

  BooleanOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    icon?: (row: T) => IconComponent  // The cell's icon for this row: a status icon replaces the dot, a boolean icon the check or cross
    labels?: readonly [string, string]
    filter?: "multi"

  SparkOptions<T>:
    header?: string  // Header text
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    label: string
    render: (row: T, box: Box) => ReactNode
    value?: (row: T) => number | null  // The line's total, drawn beside it: the column then sorts by it

  SelectOptions<T>:
    header?: string  // Header text
    id?: string  // Column id when it differs from the key (two columns over one field)
    priority?: Priority  // What survives a narrow tier: 1 always, 2 reduced and up, 3 full only
    card?: CardSlot  // First choice of card slot; the kind's own order follows
    sortable?: false  // `false` turns sorting off for this column
    headerIcon?: false | IconComponent  // The icon drawn before the header text (any component with the `IconComponent` shape)
    help?: string  // What the column answers, one or two sentences: one mark after the header label opens it as a hint
    label: (row: T) => string
    options: readonly string[]
    commit: (row: T, value: string) => unknown
    filter?: "multi"

  CustomOptions<T>:
    header?: string
    headerIcon?: IconComponent  // An icon drawn before the header text
    help?: string  // What the column answers: one mark after the header label opens it as a hint
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

`CodecKind`, `CodecOptions`, `DateRangeLike`, `KindColumn`, `RowAction`, `TableRequest`, `TableSchema` import from `basalt-ui/table`: `import type { CodecKind, CodecOptions, DateRangeLike, KindColumn, RowAction, TableRequest, TableSchema } from 'basalt-ui/table'`.

## Example

```tsx
const c = col<Booking>()
const columns = [c.entity('payee', { header: 'Payee' }), c.money('amount', { currency: 'EUR' })]
```
