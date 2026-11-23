/**
 * The names of a table's quick search: its accessible name and its placeholder. `TableToolbar` and
 * `useTableViews().search` read them here, so a key has one reference and the two boxes say the same.
 */
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'

export function useSearchLabel(label: string): { name: string; placeholder: string } {
  const t = useMessages(table)
  return { name: t('table.search'), placeholder: t('table.searchIn', label) }
}
