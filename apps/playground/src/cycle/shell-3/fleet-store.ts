/**
 * Shell cycle 3 (docs/v3/cycles/shell-3.md): the fleet app's page stores, copied from cycle 2. Every
 * piece of page state lives in the URL. Cycle 1's `labelOf` helper (shell-1.6) is gone: a field
 * handle names its own value with `label(value)`.
 */
import { defineControls, field } from 'basalt-ui/router'
import { TEAMS, TEAM_LABELS } from './fleet-api'

const RANGES = ['7d', '30d', '90d'] as const
export type Range = (typeof RANGES)[number]
export const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

export const overview = defineControls({
  id: 'cycle-shell-3-overview',
  scope: 'page',
  fields: {
    period: field
      .enum(RANGES, '30d')
      .labels({ '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }),
  },
})

export const services = defineControls({
  id: 'cycle-shell-3-services',
  scope: 'page',
  // The crumb parent's `NavTarget` clears `service` and keeps the team filter (app-shell.md).
  retain: ['team'],
  fields: {
    team: field.enum(['all', ...TEAMS], 'all').labels({ all: 'All teams', ...TEAM_LABELS }),
    service: field.string('', { history: 'push' }),
    deploy: field.string('', { history: 'push' }),
  },
})

const SETTINGS_SECTIONS = ['general', 'notifications', 'members', 'danger'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const settings = defineControls({
  id: 'cycle-shell-3-settings',
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

/** The notification preferences: instant-apply switches, remembered on this device. */
export const prefs = defineControls({
  id: 'cycle-shell-3-prefs',
  scope: 'page',
  fields: {
    failedDeploys: field.boolean(true, { url: false }),
    weeklyDigest: field.boolean(false, { url: false }),
  },
})
