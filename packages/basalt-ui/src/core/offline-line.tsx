/**
 * The one line a query paused for lack of a connection, with no data, reads: `QueryState` draws it
 * in a notice, a table in its body. Its own module so the message key has one reader.
 */
import type { ReactElement } from 'react'
import { home } from './messages/home'
import { useMessages } from './messages/use-messages'

export function OfflineLine(): ReactElement {
  const t = useMessages(home)
  return <p className="m-0 text-sm text-muted-foreground">{t('home.offline')}</p>
}
