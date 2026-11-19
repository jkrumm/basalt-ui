import type { ReactElement } from 'react'
import { OverviewPage } from './overview-page'
import { ServicesPage } from './services-page'
import { SettingsPage } from './settings-page'

/** The overview while its loader waits: the page with every slot held. */
export function OverviewPending(): ReactElement {
  return <OverviewPage data={undefined} />
}

/** The services page while its loader waits: the list and the table hold their places. */
export function ServicesPending(): ReactElement {
  return <ServicesPage data={undefined} />
}

/** The settings page while its loader waits: the list stands, the pane holds its place. */
export function SettingsPending(): ReactElement {
  return <SettingsPage settings={undefined} />
}
