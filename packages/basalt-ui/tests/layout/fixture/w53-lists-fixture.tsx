import type { ReactElement } from 'react'
import { DangerZone, SettingsRow } from '../../../src/dashboard/settings-section'

/** Wave 53: a `DangerZone` on the page surface (`w53-danger`). */
export function W53DangerFixture(): ReactElement {
  return (
    <div data-testid="w53-danger-host">
      <DangerZone title="Delete workspace" subtitle="This action cannot be undone.">
        <SettingsRow label="Delete" description="Removes every project.">
          <span>control</span>
        </SettingsRow>
      </DangerZone>
    </div>
  )
}
