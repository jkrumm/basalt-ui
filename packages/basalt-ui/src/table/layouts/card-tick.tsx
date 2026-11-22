import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Checkbox } from '../../ui/checkbox'
import type { SelectionApi } from '../core/selection'

/** The tick of a board or gallery card: the same selection the table's tick column writes. */
export function CardTick<T>({
  selection,
  id,
  title,
  className,
}: {
  selection: SelectionApi<T>
  id: string
  title: string
  className?: string
}): ReactElement {
  const t = useMessages(table)
  return (
    <Checkbox
      data-slot="table-card-tick"
      aria-label={t('table.cardPick', title)}
      checked={selection.isSelected(id)}
      onCheckedChange={() => selection.toggle(id)}
      {...(className !== undefined && { className })}
    />
  )
}

/** A click that lands on a control inside a card belongs to the control, never to the card. */
export const INTERACTIVE_IN_CARD =
  'a, button, input, select, textarea, [role="checkbox"], [role="menuitem"], [role="combobox"]'
