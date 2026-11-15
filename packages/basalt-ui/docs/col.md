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
```

## Example

```tsx
const c = col<Booking>()
const columns = [c.entity('payee', { header: 'Payee' }), c.money('amount', { currency: 'EUR' })]
```
