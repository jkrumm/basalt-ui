/** Monitors fixture (scenario expr-n23): a seeded, hand-written homelab list, the same on every load. */

const STATUSES = ['up', 'down', 'pending', 'maintenance', 'paused'] as const
export type MonitorStatus = (typeof STATUSES)[number]

export type MonitorType = 'http' | 'tcp' | 'ping' | 'dns' | 'container' | 'push' | 'group'

export type Monitor = {
  id: string
  name: string
  type: MonitorType
  /** The group monitor that holds this one, or null at the top level. */
  group: string | null
  status: MonitorStatus
  /** Last check in ms; null where the type has none (container, push, group) or the check got no answer. */
  latency: number | null
  /** Uptime over the last day and the last 30 days, in percent. */
  up1d: number
  up30d: number
}

/** A leaf slower than this, while up, counts as slow. */
export const SLOW_MS = 500
/** A running leaf under this uptime over the last day counts as flaky. */
export const FLAKY_BELOW = 99.5

const m = (
  name: string,
  type: MonitorType,
  group: string | null,
  status: MonitorStatus,
  latency: number | null,
  up1d: number,
  up30d: number,
): Monitor => ({
  id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
  name,
  type,
  group,
  status,
  latency,
  up1d,
  up30d,
})

const DEFAULT_ROWS: readonly Monitor[] = [
  m('Media stack', 'group', null, 'down', null, 91.3, 99.1),
  m('Jellyfin', 'http', 'Media stack', 'up', 62, 100, 99.97),
  m('Sonarr', 'http', 'Media stack', 'down', null, 91.3, 98.4),
  m('Radarr', 'http', 'Media stack', 'up', 71, 100, 99.9),
  m('qBittorrent', 'http', 'Media stack', 'up', 820, 99.9, 99.2),
  m('Media database', 'container', 'Media stack', 'up', null, 100, 100),
  m('Network', 'group', null, 'up', null, 99.4, 99.8),
  m('Router', 'ping', 'Network', 'up', 2, 100, 99.99),
  m('AdGuard DNS', 'dns', 'Network', 'up', 14, 99.3, 99.6),
  m('Tailscale', 'ping', 'Network', 'up', 24, 100, 99.95),
  m('NAS', 'tcp', 'Network', 'up', 9, 100, 99.88),
  m('Home automation', 'group', null, 'pending', null, 97.2, 99.4),
  m('Home Assistant', 'http', 'Home automation', 'up', 180, 97.2, 99.3),
  m('MQTT broker', 'tcp', 'Home automation', 'up', 6, 100, 99.99),
  m('Zigbee2MQTT', 'container', 'Home automation', 'up', null, 99.8, 99.7),
  m('Z-Wave bridge', 'tcp', 'Home automation', 'pending', null, 100, 99.5),
  m('Frigate', 'container', 'Home automation', 'maintenance', null, 100, 99.2),
  m('Reverse proxy', 'http', null, 'up', 45, 100, 99.99),
  m('Grafana', 'http', null, 'up', 120, 100, 99.95),
  m('Gitea', 'http', null, 'up', 95, 100, 99.9),
  m('Vaultwarden', 'http', null, 'up', 70, 100, 100),
  m('Paperless', 'http', null, 'up', 640, 99.8, 99.5),
  m('Nextcloud', 'http', null, 'up', 910, 99.9, 99.1),
  m('Mail relay', 'tcp', null, 'up', 33, 99.2, 99.4),
  m('Cloudflare tunnel', 'tcp', null, 'up', 48, 100, 99.97),
  m('Nightly backup', 'push', null, 'down', null, 95.8, 96.7),
  m('Certificate check', 'push', null, 'pending', null, 100, 100),
  m('Photos', 'http', null, 'paused', null, 100, 99.6),
  m('Old wiki', 'http', null, 'paused', null, 100, 97.8),
  m('Camera gateway', 'ping', null, 'paused', null, 100, 98.9),
]

/** Everything running and quick: the zero case, no monitor down, slow or flaky. */
const quiet = (): readonly Monitor[] =>
  DEFAULT_ROWS.map((row) => {
    if (row.status === 'paused' || row.status === 'maintenance') return row
    return {
      ...row,
      status: 'up',
      latency: row.latency === null ? null : Math.min(row.latency, 150),
      up1d: 100,
      up30d: Math.max(row.up30d, 99.5),
    }
  })

/** A bad evening: the DNS and storage hosts are gone, so most of what leans on them is too. */
const outage = (): readonly Monitor[] =>
  DEFAULT_ROWS.map((row) => {
    if (row.status === 'paused' || row.status === 'maintenance') return row
    if (row.name === 'Nextcloud') return { ...row, latency: 29_800, up1d: 41.2 }
    if (row.type === 'push' || row.name === 'Router' || row.name === 'Tailscale') return row
    return { ...row, status: 'down', latency: null, up1d: row.id.length % 3 === 0 ? 0 : 12.4 }
  })

/** The default list, or the named variant; an unknown name falls back to the default. */
export function monitorRows(fixture: string | undefined): readonly Monitor[] {
  if (fixture === 'quiet') return quiet()
  if (fixture === 'outage') return outage()
  return DEFAULT_ROWS
}

const isRunning = (row: Monitor): boolean => row.status !== 'paused' && row.status !== 'maintenance'

export const isDown = (row: Monitor): boolean => row.status === 'down'
export const isSlow = (row: Monitor): boolean =>
  row.status === 'up' && row.latency !== null && row.latency > SLOW_MS
export const isFlaky = (row: Monitor): boolean => isRunning(row) && row.up1d < FLAKY_BELOW

/** Minutes a monitor was down over the last day. */
export const minutesDown = (row: Monitor): number => Math.round(((100 - row.up1d) / 100) * 1440)

const RANK: Record<MonitorStatus, number> = {
  down: 0,
  pending: 1,
  up: 2,
  maintenance: 3,
  paused: 4,
}

/** Worst first: down, pending, slow, flaky, then the rest by name, groups ahead of their members. */
export function bySeverity(rows: readonly Monitor[]): readonly Monitor[] {
  const score = (row: Monitor): number =>
    RANK[row.status] * 10 + (isSlow(row) ? 0 : isFlaky(row) ? 1 : 2)
  return rows.toSorted((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
}

/** What the table's status column shows: a running monitor that is slow or flaky says so. */
export type ShownState = MonitorStatus | 'slow' | 'flaky'

/** A monitor as the table lists it. */
export type MonitorRow = Monitor & { shown: ShownState }

export function toRows(rows: readonly Monitor[]): readonly MonitorRow[] {
  return rows.map((row) => ({
    ...row,
    shown: isSlow(row) ? 'slow' : isFlaky(row) && row.status === 'up' ? 'flaky' : row.status,
  }))
}

/** Minutes a monitor is down on an average day of the last 30. */
export const usualMinutesDown = (row: Monitor): number =>
  Math.round(((100 - row.up30d) / 100) * 1440)
