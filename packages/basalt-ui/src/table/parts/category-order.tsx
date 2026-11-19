/**
 * The order of a status column's categories (docs/v3/concepts/data-table.md section 3, owner review
 * 1): the column's options as a list the user rearranges, by dragging a row or from the keyboard
 * (`order-list.tsx` owns the keys and the drag). Each change writes `request.ranks` through
 * `setRank`, which also sorts the table by the column, so the rows behind the popup follow at once
 * and the URL and a saved view carry the order. Reset to default drops the rank.
 */
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Status } from '../../ui/status'
import type { KindSpec } from '../core/kinds-spec'
import type { TableModel } from '../use-data-table'
import { OrderList } from './order-list'

/**
 * The rearrangeable list of one status column's categories. Renders inside the header's popover
 * and inline in the `Filters (n)` sheet.
 */
export function CategoryOrder<T>({
  model,
  spec,
  titleId,
}: {
  model: TableModel<T>
  spec: KindSpec<T>
  /** The id of the list's title, so a popover holding it can take its name from it. */
  titleId?: string
}): ReactElement {
  const t = useMessages(table)
  const ownTitleId = useId()
  const titleOf = titleId ?? ownTitleId
  const [resets, setResets] = useState(0)
  const ranked = (model.state.request.ranks?.[spec.id]?.length ?? 0) > 0
  const labelOf = (value: string): string => spec.labels?.[value] ?? value

  return (
    <div data-slot="table-order" className="flex min-w-0 flex-col gap-2">
      <span id={titleOf} className="font-medium">
        {t('table.orderOf', spec.header)}
      </span>
      <OrderList
        order={model.rankOf(spec.id)}
        labelOf={labelOf}
        labelledBy={titleOf}
        announceKey={resets}
        onCommit={(_value, next) => model.setRank(spec.id, next)}
        renderItem={(value, index) => (
          <>
            {spec.tone === undefined ? (
              <span className="min-w-0 flex-1 truncate">{labelOf(value)}</span>
            ) : (
              <Status tone={spec.tone(value)} className="min-w-0 flex-1">
                {labelOf(value)}
              </Status>
            )}
            <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
              {index + 1}
            </span>
          </>
        )}
        footer={
          <Button
            variant="ghost"
            size="sm"
            disabled={!ranked}
            onClick={() => {
              model.setRank(spec.id, spec.options ?? [])
              setResets((n) => n + 1)
            }}
          >
            {t('table.orderReset')}
          </Button>
        }
      />
    </div>
  )
}
