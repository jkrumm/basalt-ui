/** Shell cycle 1: the fleet app's page stores. Every piece of page state lives in the URL. */
import { defineControls, field } from 'basalt-ui/router'
import { TEAMS, TEAM_LABELS } from './fleet-api'

export const RANGES = ['7d', '30d', '90d'] as const
export type Range = (typeof RANGES)[number]
export const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

export const overview = defineControls({
  id: 'cycle-shell-overview',
  scope: 'page',
  fields: {
    period: field
      .enum(RANGES, '30d')
      .labels({ '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }),
  },
})

export const services = defineControls({
  id: 'cycle-shell-services',
  scope: 'page',
  fields: {
    team: field.enum(['all', ...TEAMS], 'all').labels({ all: 'All teams', ...TEAM_LABELS }),
    service: field.string('', { history: 'push' }),
    deploy: field.string('', { history: 'push' }),
  },
})

/** cycle-shell-1: shell-1.6 — a field handle has `options` but no label lookup for its value. */
export function labelOf<V>(
  handle: { readonly options: readonly { value: V; label: string }[] },
  value: V,
): string {
  return handle.options.find((option) => option.value === value)?.label ?? String(value)
}

export const SETTINGS_SECTIONS = ['general', 'notifications', 'members', 'danger'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const settings = defineControls({
  id: 'cycle-shell-settings',
  scope: 'page',
  fields: {
    section: field.enum(SETTINGS_SECTIONS, 'general', { history: 'push' }).labels({
      general: 'General',
      notifications: 'Notifications',
      members: 'Members',
      danger: 'Danger zone',
    }),
  },
})
