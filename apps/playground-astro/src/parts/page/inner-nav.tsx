import { InnerNav } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { settings } from './fixtures'

export function Demo(): ReactElement {
  return (
    <div className="max-w-xs">
      <InnerNav
        label="Settings"
        state={settings.field.section}
        groups={[
          {
            id: 'account',
            label: 'Account',
            items: [
              { id: 'profile', label: 'Profile' },
              { id: 'appearance', label: 'Appearance' },
            ],
          },
          {
            id: 'workspace',
            label: 'Workspace',
            items: [{ id: 'billing', label: 'Billing', badge: { dot: true } }],
          },
        ]}
      />
    </div>
  )
}
