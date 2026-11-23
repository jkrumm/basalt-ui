/**
 * `+ Filter`: the popover that picks a filterable column and edits its value in that kind's editor.
 * `TableToolbar` draws it in its row and `useTableViews().controls` hands it to `PageBar`; both write
 * the table's one state, so the chips and the header menu stay in step.
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import type { TableModel } from '../use-data-table'
import { FilterEditor } from './toolbar-editor'
import { filterableSpecs } from './toolbar-filters'

/** `+ Filter`: pick a filterable column, then edit its value in that kind's editor. */
export function AddFilter<T>({ model }: { model: TableModel<T> }): ReactElement | null {
  const t = useMessages(table)
  const specs = filterableSpecs(model.specs)
  const [picked, setPicked] = useState<string | null>(null)
  const spec = specs.find((s) => s.id === picked)
  if (specs.length === 0) return null
  return (
    <Popover onOpenChange={(open) => open && setPicked(null)}>
      <PopoverTrigger render={<Button />}>{t('table.filterAdd')}</PopoverTrigger>
      <PopoverContent
        aria-label={t('table.filterColumn')}
        align="start"
        {...(spec !== undefined && spec.filter === 'range' && { className: 'w-80' })}
      >
        {spec === undefined ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {specs.map((s) => (
              <li key={s.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setPicked(s.id)}
                >
                  {s.header}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="justify-start" onClick={() => setPicked(null)}>
              {t('table.filterBack')}
            </Button>
            <span className="font-medium">{spec.header}</span>
            <FilterEditor model={model} spec={spec} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
