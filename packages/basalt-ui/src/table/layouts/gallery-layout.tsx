/**
 * The gallery layout (docs/v3/concepts/data-table.md section 3, Layouts): a `CardGrid` of the table's
 * rows, one card per row from its card face, drawn with the cells' own renders. A grouped view is
 * one section per group with its label and count; the rest is the table's (selection, activation,
 * pager).
 *
 * A card's title is its button: a click anywhere on the card opens the row as a click on a table row
 * does. Off-screen cards skip their layout and paint (`content-visibility` in `table.css`), which is
 * what keeps a long client gallery cheap; a server gallery pages.
 */
import type { ReactElement, ReactNode } from 'react'
import { CardGrid } from '../../page/card-grid'
import { Card } from '../../ui/card'
import type { CellEnv } from '../core/kinds-spec'
import { cellEnvOf } from '../parts/body'
import type { ModelRow, TableModel } from '../use-data-table'
import { CardTick } from './card-tick'
import { cardFace, textOf } from './model'
import type { FaceValue } from './model'

function cell<T>(value: FaceValue<T>, row: T, env: CellEnv): ReactNode {
  return value.spec.render?.(row, env) ?? value.text
}

function GalleryCard<T>({
  model,
  row,
  env,
}: {
  model: TableModel<T>
  row: ModelRow<T>
  env: CellEnv
}): ReactElement {
  const face = cardFace(model, row.original)
  const facts = [face.value, ...face.meta].filter((v) => v !== undefined).slice(0, 2)
  const selection = model.selection
  const ticked = selection?.isSelected(row.id) === true
  return (
    <div
      data-slot="table-gallery-card"
      data-selected={ticked ? '' : undefined}
      className="group/gallery relative min-w-0 p-px transition-transform duration-fast ease-standard hover:-translate-y-0.5 motion-reduce:transition-none"
    >
      <Card flush className="h-full">
        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <button
                type="button"
                data-slot="table-gallery-open"
                className="min-h-6 min-w-0 cursor-pointer truncate text-start text-sm font-medium text-foreground after:absolute after:inset-0 after:rounded-card focus-ring focus-visible:after:outline-2"
                onClick={() => model.activate(row.id)}
              >
                {face.title}
              </button>
              {face.subtitle !== undefined && (
                <span className="truncate text-xs text-muted-foreground">{face.subtitle.text}</span>
              )}
            </div>
            {selection !== undefined && (
              <span className="relative z-10 inline-flex shrink-0">
                <CardTick selection={selection} id={row.id} title={face.title} />
              </span>
            )}
          </div>
          {face.badges.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {face.badges.map((badge) => (
                <span key={badge.spec.id} className="inline-flex min-w-0">
                  {cell(badge, row.original, env)}
                </span>
              ))}
            </div>
          )}
          {facts.length > 0 && (
            <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-3">
              {facts.map((fact) => (
                <div key={fact.spec.id} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="truncate text-xs text-muted-foreground">{fact.label}</dt>
                  <dd className="m-0 truncate text-sm text-foreground tabular-nums">
                    {cell(fact, row.original, env)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Card>
    </div>
  )
}

/** One group of a grouped gallery: its value as the column shows it, and how many rows it holds. */
type Section<T> = { key: string; label: string; count: number; rows: readonly ModelRow<T>[] }

function sectionsOf<T>(model: TableModel<T>): readonly Section<T>[] | undefined {
  const by = model.groupBy === null ? undefined : model.specs.find((s) => s.id === model.groupBy)
  if (by === undefined) return undefined
  return model.items.flatMap((item) => {
    if (item.type !== 'group') return []
    const first = item.rows[0]
    const label = first === undefined ? item.value : textOf(by, first.original, model) || item.value
    return [{ key: item.key, label, count: item.members.length, rows: item.rows }]
  })
}

export function GalleryLayout<T>({ model }: { model: TableModel<T> }): ReactElement {
  const env = cellEnvOf(model)
  const sections = sectionsOf(model)
  const grid = (rows: readonly ModelRow<T>[]): ReactElement => (
    <CardGrid min="narrow">
      {rows.map((row) => (
        <GalleryCard key={row.id} model={model} row={row} env={env} />
      ))}
    </CardGrid>
  )
  return (
    <section
      data-slot="table-gallery"
      aria-label={model.label}
      className="flex min-w-0 flex-col gap-6"
    >
      {sections === undefined
        ? grid(model.rows)
        : sections.map((section) => (
            <section
              key={section.key}
              aria-label={section.label}
              className="flex min-w-0 flex-col gap-2.5"
            >
              <header className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{section.label || '—'}</span>
                <span
                  data-slot="table-gallery-count"
                  className="inline-flex h-5 items-center rounded-chip bg-secondary px-1.5 text-xs text-muted-foreground tabular-nums"
                >
                  {section.count}
                </span>
              </header>
              {grid(section.rows)}
            </section>
          ))}
    </section>
  )
}
