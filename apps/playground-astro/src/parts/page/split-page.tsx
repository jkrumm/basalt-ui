import { Facts, InnerNav, Section, SplitPage } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { settings } from './fixtures'

export function Demo(): ReactElement {
  return (
    <SplitPage
      selected={false}
      backLabel="Settings"
      list={() => (
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
              items: [{ id: 'billing', label: 'Billing' }],
            },
          ]}
        />
      )}
      detail={() => (
        <Section title="Profile">
          <Facts
            rows={[
              { label: 'Name', value: 'Ada Lovelace' },
              { label: 'Email', value: 'ada@example.com' },
            ]}
          />
        </Section>
      )}
    />
  )
}
