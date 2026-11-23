import { createFileRoute, useRouterState } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import {
  SettingsPage,
  settingsControls,
} from '../../../../../packages/basalt-ui/blocks/settings-page/SettingsPage'

function RefSettingsRoute(): ReactElement {
  const hash = useRouterState({ select: (state) => state.location.hash })
  return <SettingsPage hash={hash} />
}

export const Route = createFileRoute('/ref/settings')({
  staticData: { title: 'Inventory settings' },
  validateSearch: settingsControls.validateSearch,
  search: { middlewares: settingsControls.middlewares },
  component: RefSettingsRoute,
})
