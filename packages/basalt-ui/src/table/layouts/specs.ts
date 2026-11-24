/**
 * The layouts a table offers, as one list of specs: the built-ins resolved with their localized
 * label, hint and glyph, an app's `TableLayoutSpec` as written. The toggle, `+ View`'s menu, the
 * view row and `DataTable` read this list and nothing else, so a built-in and an app's layout are
 * the same kind of entry.
 */
import type { IconComponent } from '../../core/ports'
import type { BuiltinLayout, TableLayoutSpec } from '../contract'
import { BoardGlyph, GalleryGlyph, ListGlyph, TableGlyph } from './glyphs'

/** One layout the table offers. `render` is absent on a built-in: `DataTable` draws those itself. */
export type LayoutEntry<T> = {
  readonly id: string
  readonly label: string
  readonly hint: string | undefined
  readonly icon: IconComponent
  readonly render?: TableLayoutSpec<T>['render']
}

type LayoutKey =
  | 'table.layoutTable'
  | 'table.layoutList'
  | 'table.layoutBoard'
  | 'table.layoutGallery'
  | 'table.layoutTableHint'
  | 'table.layoutListHint'
  | 'table.layoutBoardHint'
  | 'table.layoutGalleryHint'

const BUILTIN: Readonly<
  Record<BuiltinLayout, { label: LayoutKey; hint: LayoutKey; icon: IconComponent }>
> = {
  table: { label: 'table.layoutTable', hint: 'table.layoutTableHint', icon: TableGlyph },
  list: { label: 'table.layoutList', hint: 'table.layoutListHint', icon: ListGlyph },
  board: { label: 'table.layoutBoard', hint: 'table.layoutBoardHint', icon: BoardGlyph },
  gallery: { label: 'table.layoutGallery', hint: 'table.layoutGalleryHint', icon: GalleryGlyph },
}

/** Whether the id names a layout the kit draws itself. */
export const isBuiltinLayout = (id: string): id is BuiltinLayout => Object.hasOwn(BUILTIN, id)

/**
 * The asked layouts as entries, in order. A spec whose id is a built-in's or another entry's throws
 * in a dev build (a saved view could not tell them apart); production keeps the first.
 */
export function resolveLayouts<T>(
  table: string,
  asked: readonly (BuiltinLayout | TableLayoutSpec<T>)[],
  t: (key: LayoutKey) => string,
): readonly LayoutEntry<T>[] {
  const seen = new Set<string>()
  const entries: LayoutEntry<T>[] = []
  for (const layout of asked) {
    const id = typeof layout === 'string' ? layout : layout.id
    const clash = seen.has(id) || (typeof layout !== 'string' && isBuiltinLayout(id))
    if (clash) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          `basalt-ui/table: "${table}" offers the layout id "${id}" twice; a layout id is unique and never a built-in's.`,
        )
      }
      continue
    }
    seen.add(id)
    if (typeof layout === 'string') {
      const builtin = BUILTIN[layout]
      entries.push({ id, label: t(builtin.label), hint: t(builtin.hint), icon: builtin.icon })
    } else {
      entries.push({
        id,
        label: layout.label,
        hint: layout.hint,
        icon: layout.icon,
        render: layout.render,
      })
    }
  }
  return entries
}
