/**
 * The layout toggle of a table view: one pressed icon per layout the table offers, writing the
 * view's `display.layout`. The same options feed `PageBar layout` (`useTableViews().layout`) and
 * the `+ View` menu, so a layout has one name, one hint and one glyph.
 */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { ControlHandle, IconComponent } from '../../core/ports'
import { Button } from '../../ui/button'
import type { TableLayout } from '../contract'
import type { TableModel } from '../use-data-table'

type GlyphProps = Parameters<IconComponent>[0]

const glyph =
  (paths: readonly string[]): IconComponent =>
  ({ className }: GlyphProps) => (
    <svg viewBox="0 0 16 16" className={className ?? 'size-icon'} fill="none" aria-hidden="true">
      {paths.map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )

/** Rows under a head. */
export const TableGlyph = glyph(['M2.5 3.5h11v9h-11z', 'M2.5 6.5h11', 'M2.5 9.5h11', 'M6 6.5v6'])
/** Lines with a mark at their start. */
export const ListGlyph = glyph([
  'M5.5 4h8',
  'M5.5 8h8',
  'M5.5 12h8',
  'M2.5 4h.5',
  'M2.5 8h.5',
  'M2.5 12h.5',
])
/** Three columns of unequal height. */
export const BoardGlyph = glyph(['M2.5 2.5h3v9h-3z', 'M6.5 2.5h3v6h-3z', 'M10.5 2.5h3v11h-3z'])
/** A grid of four cards. */
export const GalleryGlyph = glyph([
  'M2.5 2.5h4.5v4.5h-4.5z',
  'M9 2.5h4.5v4.5h-4.5z',
  'M2.5 9h4.5v4.5h-4.5z',
  'M9 9h4.5v4.5h-4.5z',
])

export type LayoutOption = { value: TableLayout; label: string; hint: string; icon: IconComponent }

/** The layouts the table offers, each with its name, its one-line hint and its glyph. */
export function useLayoutOptions<T>(model: TableModel<T>): readonly LayoutOption[] {
  const t = useMessages(table)
  const all: Record<TableLayout, LayoutOption> = {
    table: {
      value: 'table',
      label: t('table.layoutTable'),
      hint: t('table.layoutTableHint'),
      icon: TableGlyph,
    },
    list: {
      value: 'list',
      label: t('table.layoutList'),
      hint: t('table.layoutListHint'),
      icon: ListGlyph,
    },
    board: {
      value: 'board',
      label: t('table.layoutBoard'),
      hint: t('table.layoutBoardHint'),
      icon: BoardGlyph,
    },
    gallery: {
      value: 'gallery',
      label: t('table.layoutGallery'),
      hint: t('table.layoutGalleryHint'),
      icon: GalleryGlyph,
    },
  }
  return model.layouts.map((layout) => all[layout])
}

/** The name the toggle carries as a group. */
export function useLayoutLabel(): string {
  return useMessages(table)('table.layout')
}

/**
 * The view's layout as a field handle, for `PageBar layout`: it reads and writes the table's display,
 * so a saved view and the toggle stay one value. Built per render from the model it closes over.
 */
export function layoutHandle<T>(model: TableModel<T>): ControlHandle<TableLayout> {
  return {
    key: `${model.id}.layout`,
    kind: 'enum',
    options: model.layouts.map((value) => ({ value, label: value })),
    use: () => [model.layout, (next) => model.setLayout(next)],
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: () => model.setLayout('table'),
    isDefault: model.layout === 'table',
  }
}

/**
 * The toggle beside Edit view in `TableToolbar`: pressed icon buttons on a tinted track, the look of
 * `PageBar`'s layout toggle. Nothing when the table offers one layout.
 */
export function LayoutToggle<T>({ model }: { model: TableModel<T> }): ReactElement | null {
  const options = useLayoutOptions(model)
  const label = useLayoutLabel()
  if (options.length < 2) return null
  return (
    <fieldset
      aria-label={label}
      data-slot="table-layout-toggle"
      className="m-0 inline-flex shrink-0 items-center gap-0.5 rounded-ctrl border-0 bg-accent p-0.5"
    >
      {options.map(({ value, label: name, icon: Icon }) => (
        <Button
          key={value}
          variant="ghost"
          shape="icon"
          aria-label={name}
          aria-pressed={value === model.layout}
          title={name}
          className="size-[calc(var(--basalt-ctl-h)-0.25rem)] rounded-[calc(var(--radius-ctrl)-2px)] text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground aria-pressed:shadow-raised forced-colors:border forced-colors:border-current forced-colors:aria-pressed:border-2"
          onClick={() => model.setLayout(value)}
        >
          <Icon className="size-icon" aria-hidden="true" />
        </Button>
      ))}
    </fieldset>
  )
}
