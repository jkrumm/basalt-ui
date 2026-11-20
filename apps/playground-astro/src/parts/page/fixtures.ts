import { defineControls, field } from 'basalt-ui/router'

/** The runs page's controls: two filters and a view switch, each a field handle on the URL or the device. */
export const runs = defineControls({
  id: 'parts-runs',
  scope: 'page',
  fields: {
    region: field
      .enum(['all', 'eu', 'us'], 'all')
      .labels({ all: 'All regions', eu: 'EU', us: 'US' }),
    status: field.multi(['open', 'blocked', 'done'], []),
    tab: field
      .enum(['all', 'mine'], 'all', { history: 'push' })
      .labels({ all: 'All', mine: 'Mine' }),
  },
})

/** The settings sections as a push field: each section is a history entry (InnerNav, SplitPage). */
export const settings = defineControls({
  id: 'parts-settings',
  scope: 'page',
  fields: {
    section: field
      .enum(['profile', 'appearance', 'billing'], 'profile', { history: 'push' })
      .labels({ profile: 'Profile', appearance: 'Appearance', billing: 'Billing' }),
  },
})
