import { lists } from './messages/lists'
import { useMessages } from './messages/use-messages'

/** The 'n of m shown' cue of a list a height clips (a BarList that scrolls, a card list cut at `maxRows`): one message, one consumer. */
export function useRowsShown(): (shown: number, total: number) => string {
  const t = useMessages(lists)
  return (shown, total) => t('lists.rowsShown', shown, total)
}
