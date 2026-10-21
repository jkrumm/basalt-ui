/**
 * `meta.kind` for `BasaltDataTable` (`docs/waves/design-parity/SPEC.md` § 6.6): the chrome a cell
 * takes by KIND, and the content a kind supplies when its column has no `cell` of its own. The table
 * calls three seams from its header and cell render sites: {@link resolveKind} (validate),
 * {@link kindClass} / {@link kindAlign} (chrome) and {@link KindCell} (content).
 */
import { Badge, Skeleton, Tooltip } from '@mantine/core'
import type { Cell, Column, RowData } from '@tanstack/react-table'
import { FlexRender } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import { Meter } from '../dashboard/meter'
import { dateTime, integer, relativeTime } from '../format'
import { numberFormat } from '../format/shared'
import { DATA_TABLE_COLUMN_KINDS } from './table-features'
import type { BasaltTableFeatures, DataTableAlign, DataTableColumnKind } from './table-features'
import classes from './cell-kinds.module.css'

/**
 * The table's own default `cell` (TanStack's, restated), installed as `defaultColumn.cell` so a
 * column WITHOUT a renderer is identifiable by identity: v9 merges its default into every
 * `columnDef`, so `columnDef.cell === undefined` can never be asked.
 */
export function DEFAULT_CELL(props: { renderValue(): unknown }) {
  return (props.renderValue() as { toString?(): string } | null | undefined)?.toString?.() ?? null
}

const KINDS: ReadonlySet<string> = new Set(DATA_TABLE_COLUMN_KINDS)

/** Reads `meta.kind`, throwing on a value outside the seven — the check a type cannot make at runtime. */
export function resolveKind<T extends RowData>(
  column: Column<BasaltTableFeatures, T, unknown>,
): DataTableColumnKind | undefined {
  const kind = column.columnDef.meta?.kind
  if (kind === undefined) return undefined
  if (!KINDS.has(kind)) {
    throw new Error(
      `BasaltDataTable: column "${column.id}" has meta.kind=${JSON.stringify(kind)} — ` +
        `expected ${DATA_TABLE_COLUMN_KINDS.map((k) => `'${k}'`).join(' | ')}.`,
    )
  }
  return kind
}

/** Figures read right: the kind's default alignment, which an explicit `meta.align` overrides. */
export function kindAlign(kind: DataTableColumnKind | undefined): DataTableAlign | undefined {
  return kind === 'number' || kind === 'money' ? 'right' : undefined
}

/**
 * Column sizing law (SPEC § 6.6): a data column is as wide as its header or widest cell (body cells
 * hold one line), and the slack of a wide container goes to ONE place — the LAST `text` column (a
 * notes/detail column that may wrap), else a trailing spacer after the last data column — so a name
 * sits beside its figures, never a third of the table away. An `entity` column is content-sized.
 * `fixedIds` (the checkbox and actions columns) fit too but are not data. An earlier `text` column
 * keeps its auto share (it may wrap), and a table where no column opted into a kind renders as
 * before: no fit marks, no spacer.
 */
export function planColumnSizing<T extends RowData>(
  columns: readonly Column<BasaltTableFeatures, T, unknown>[],
  fixedIds: ReadonlySet<string>,
): { fitIds: ReadonlySet<string>; spacer: boolean } {
  const data = columns.filter((column) => !fixedIds.has(column.id))
  const kinds = new Map(data.map((column) => [column.id, resolveKind(column)]))
  const fitIds = new Set(columns.filter((column) => fixedIds.has(column.id)).map((c) => c.id))
  const hasKinds = data.some((column) => kinds.get(column.id) !== undefined)
  if (!hasKinds) return { fitIds, spacer: false }
  const slackId = data.findLast((column) => kinds.get(column.id) === 'text')?.id
  for (const column of data) {
    if (column.id === slackId || kinds.get(column.id) === 'text') continue
    fitIds.add(column.id)
  }
  return { fitIds, spacer: slackId === undefined }
}

/** A loading bar shaped like the kind's value: a figure short and flush right, a chip chip-sized. */
export function KindSkeleton({
  kind,
  right,
}: {
  kind: DataTableColumnKind | undefined
  right: boolean
}): ReactNode {
  const chip = kind === 'status'
  const width =
    kind === 'number' || kind === 'money'
      ? '3rem'
      : chip || kind === 'relative-time'
        ? '4.5rem'
        : kind === 'meter'
          ? '4rem'
          : kind === 'entity'
            ? '9rem'
            : kind === 'text'
              ? '10rem'
              : '6rem'
  // A fixed length, never a share of the cell: a content-sized column has no width to take a share
  // of, and the slack column's is the whole container. `maw` keeps it inside a narrow cell.
  return (
    <Skeleton
      height={chip ? 20 : 16}
      radius="sm"
      w={width}
      maw="100%"
      {...(right && { ml: 'auto' })}
    />
  )
}

const KIND_CLASS: Record<DataTableColumnKind, string> = {
  entity: classes.entity,
  status: classes.status,
  number: classes.number,
  money: classes.number,
  'relative-time': classes.relativeTime,
  meter: classes.meter,
  text: classes.text,
}

export function kindClass(kind: DataTableColumnKind): string {
  return cx(KIND_CLASS[kind])
}

/** A whole number groups; a fraction is kept whole (`integer` would round 12.5 to 13). */
function formatFigure(value: number): string {
  return Number.isInteger(value)
    ? integer(value)
    : numberFormat(undefined, { signDisplay: 'negative', maximumFractionDigits: 20 }).format(value)
}

/**
 * A `money` figure: grouped, with the currency's own minor digits (`120,000.00` USD, `120,000` JPY)
 * and no symbol — the header names the code (`Salary (USD / yr)`, SPEC § 6.6).
 */
function formatMoney(value: number, currency: string): string {
  const digits = numberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits
  return numberFormat(undefined, {
    signDisplay: 'negative',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** The theme draws no dot for plain `gray`, but every chip in a status column carries one. */
const chipColor = (color: string | undefined): string =>
  color === undefined || color === 'gray' ? 'var(--vx-faint)' : color

const Dash = () => <span className={classes.dash}>—</span>

function isAbsent(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function toDate(value: unknown): Date | undefined {
  if (!(value instanceof Date) && typeof value !== 'number' && typeof value !== 'string') {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function columnLabel<T extends RowData>(column: Column<BasaltTableFeatures, T, unknown>): string {
  const { header } = column.columnDef
  return typeof header === 'string' ? header : column.id
}

function RelativeTime({ value }: { value: unknown }) {
  const date = toDate(value)
  if (date === undefined) return <Dash />
  const full = dateTime(date)
  return (
    // Below the cell and on keyboard focus: above it the tip covered the header's label on row one.
    <Tooltip label={full} position="bottom" events={{ hover: true, focus: true, touch: false }}>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the tooltip opens on focus */}
      <time dateTime={date.toISOString()} tabIndex={0}>
        {relativeTime(date)}
        <span className={classes.srOnly}>{`, ${full}`}</span>
      </time>
    </Tooltip>
  )
}

/** The cell of a column with a `kind`: the column's own `cell` if it has one, else the kind's content. */
export function KindCell<T extends RowData>({
  kind,
  cell,
}: {
  kind: DataTableColumnKind
  cell: Cell<BasaltTableFeatures, T, unknown>
}): ReactNode {
  const { column } = cell
  const { cell: render, meta } = column.columnDef
  if (render !== DEFAULT_CELL) return <FlexRender cell={cell} />
  const value = cell.getValue()
  switch (kind) {
    case 'number':
    case 'money': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return <Dash />
      return kind === 'money' ? formatMoney(value, meta?.currency ?? 'USD') : formatFigure(value)
    }
    case 'relative-time':
      return <RelativeTime value={value} />
    case 'status':
      if (isAbsent(value)) return <Dash />
      return <Badge color={chipColor(meta?.statusColor?.(value))}>{String(value)}</Badge>
    case 'meter':
      return (
        <Meter
          size="row"
          label={columnLabel(column)}
          value={typeof value === 'number' ? value : null}
          max={meta?.meterMax ?? 1}
        />
      )
    case 'entity':
    case 'text':
      return isAbsent(value) ? <Dash /> : String(value)
    default:
      return kind satisfies never
  }
}

/** A cell's content through its kind when it has one — the body cell and the fold disclosure share it. */
export function CellContent<T extends RowData>({
  cell,
}: {
  cell: Cell<BasaltTableFeatures, T, unknown>
}): ReactNode {
  const kind = resolveKind(cell.column)
  return kind === undefined ? <FlexRender cell={cell} /> : <KindCell kind={kind} cell={cell} />
}
