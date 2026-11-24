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
import type { TableModel } from '../use-data-table'

export type LayoutOption = {
  value: string
  label: string
  hint: string | undefined
  icon: IconComponent
}

/** The layouts the table offers, each with its name, its one-line hint and its glyph. */
export function useLayoutOptions<T>(model: TableModel<T>): readonly LayoutOption[] {
  return model.layouts.map(({ id, label, hint, icon }) => ({ value: id, label, hint, icon }))
}

/** The name the toggle carries as a group. */
export function useLayoutLabel(): string {
  return useMessages(table)('table.layout')
}

/**
 * The view's layout as a field handle, for `PageBar layout`: it reads and writes the table's display,
 * so a saved view and the toggle stay one value. Built per render from the model it closes over.
 */
export function layoutHandle<T>(model: TableModel<T>): ControlHandle<string> {
  return {
    key: `${model.id}.layout`,
    kind: 'enum',
    options: model.layouts.map(({ id, label }) => ({ value: id, label })),
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
          className="size-[calc(var(--basalt-ctl-h)-0.25rem)] rounded-chip text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground aria-pressed:shadow-raised forced-colors:border forced-colors:border-current forced-colors:aria-pressed:border-2"
          onClick={() => model.setLayout(value)}
        >
          <Icon className="size-icon" aria-hidden="true" />
        </Button>
      ))}
    </fieldset>
  )
}
