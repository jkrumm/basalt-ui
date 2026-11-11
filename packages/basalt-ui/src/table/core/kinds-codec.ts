/**
 * `c.codec`: the table's state schema as ids and kinds only, so it can sit at module scope while
 * the columns and their closures arrive at render (docs/v3/concepts/data-table.md section 4). The
 * URL grammar over it is `core/codec`; this module owns the descriptor and the dev check that the
 * descriptor and the rendered columns agree.
 */
import type { KindColumn, TableRequest } from '../contract'
import { KIND_DEFAULTS, specOf } from './kinds-spec'
import type { KindName } from './kinds-spec'

/** Kinds a codec may name: every kind that has a value in state. */
export type CodecKind = Exclude<KindName, 'actions'>

export type CodecOptions = { defaults?: Partial<TableRequest>; prefix?: string }

/** What `c.codec` returns: ids and kinds only. */
export type TableSchema<
  M extends Readonly<Record<string, CodecKind>> = Readonly<Record<string, CodecKind>>,
> = {
  readonly kinds: M
  readonly defaults: Partial<TableRequest>
  readonly prefix: string | undefined
}

const CODEC_KINDS = (Object.keys(KIND_DEFAULTS) as KindName[]).filter((k) => k !== 'actions')

export function codec<const M extends Readonly<Record<string, CodecKind>>>(
  kinds: M,
  o?: CodecOptions,
): TableSchema<M> {
  if (process.env.NODE_ENV !== 'production') {
    for (const [id, kind] of Object.entries(kinds)) {
      if (!CODEC_KINDS.includes(kind)) {
        throw new Error(
          `basalt-ui/table: c.codec id "${id}" has kind ${JSON.stringify(kind)}, not a value kind`,
        )
      }
    }
    for (const sort of o?.defaults?.sort ?? []) {
      if (!Object.hasOwn(kinds, sort.id)) {
        throw new Error(
          `basalt-ui/table: c.codec default sort names "${sort.id}", which the codec does not list`,
        )
      }
    }
  }
  return { kinds, defaults: o?.defaults ?? {}, prefix: o?.prefix }
}

/**
 * Dev check that a codec and the rendered columns agree: an id absent from `columns`, or listed
 * under another kind, throws. The parts call it when the columns change; production skips it.
 */
export function checkSchema<T>(schema: TableSchema, columns: readonly KindColumn<T>[]): void {
  if (process.env.NODE_ENV === 'production') return
  const byId = new Map(columns.map((column) => [column.id, specOf(column).kind]))
  for (const [id, kind] of Object.entries(schema.kinds)) {
    const actual = byId.get(id)
    if (actual === undefined) {
      throw new Error(
        `basalt-ui/table: c.codec lists "${id}", but no column has that id (columns: ${[...byId.keys()].join(', ')})`,
      )
    }
    if (actual !== kind) {
      throw new Error(
        `basalt-ui/table: c.codec lists "${id}" as ${kind}, but the column is ${actual}`,
      )
    }
  }
}
