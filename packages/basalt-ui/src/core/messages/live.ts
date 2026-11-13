import type { Format } from '../format'
import type { ConnectionView } from '../ports'
import type { BasaltMessages } from './index'

/**
 * The strings the live views print. `live.connected`, `live.polling`, `live.reconnecting`,
 * `live.offline` and `live.unauthorized` are the `ConnectionIndicator` states; `live.name`,
 * `live.stream`, `live.lastEvent`, `live.dataAge`, `live.never` and `live.streamState` label its
 * popover rows; `live.refresh` is the `RefreshButton` default label and `live.updated` the line it
 * prints on paper.
 */
export type LiveMessages = Record<
  | 'live.connected'
  | 'live.polling'
  | 'live.reconnecting'
  | 'live.offline'
  | 'live.unauthorized'
  | 'live.name'
  | 'live.stream'
  | 'live.lastEvent'
  | 'live.dataAge'
  | 'live.never'
  | 'live.refresh',
  string
> &
  Record<'live.updated', (f: Format, at: number) => string> &
  Record<'live.streamState', (f: Format, stream: ConnectionView['stream']) => string>

const STREAM_STATE: Record<ConnectionView['stream'], string> = {
  none: 'No stream',
  idle: 'Idle',
  connecting: 'Connecting',
  live: 'Connected',
  retrying: 'Reconnecting',
  unauthorized: 'Unauthorized',
  failed: 'Failed',
  done: 'Finished',
}

export const live = {
  'live.connected': 'Live',
  'live.polling': 'Polling',
  'live.reconnecting': 'Reconnecting',
  'live.offline': 'Offline',
  'live.unauthorized': 'Signed out',
  'live.name': 'Connection',
  'live.stream': 'Stream',
  'live.lastEvent': 'Last event',
  'live.dataAge': 'Data',
  'live.never': 'None yet',
  'live.refresh': 'Refresh',
  'live.updated': (f, at) => `Updated ${f.dateTime(at)}`,
  'live.streamState': (_f, stream) => STREAM_STATE[stream] ?? String(stream),
} satisfies Partial<BasaltMessages>
