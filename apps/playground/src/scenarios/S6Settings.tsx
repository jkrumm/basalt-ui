/**
 * S6 — Settings and entry (stands for a desktop app's account page and a training log's set form).
 * docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Change one thing without breaking another.
 *   Decision: Save or cancel.
 *
 * Two boxes: `settings-account` (SettingsSection / SettingsRow / DangerZone) and `settings-entry`
 * (`basalt-ui/forms` + FormRow / FormGroup). Empty empties the key list, loading draws the forms'
 * shapes in grey, error is the account page's failed load and the entry form's failed validation (Reps keeps its value and shows one sentence).
 */
import { Box, SimpleGrid } from '@mantine/core'
import { CONTAINER_KEYS } from 'basalt-ui/tokens'
import { AccountSettings } from './settings/account'
import { EntryForm } from './settings/entry-form'
import type { ScenarioProps } from './shot-state'

export function SettingsScenario({ shotState }: ScenarioProps) {
  return (
    // Side by side at regular width: a 20rem control column in a full-width card leaves the card half empty.
    <SimpleGrid
      type="container"
      cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}
      spacing="sm"
      data-shot-states="empty loading error"
    >
      <Box data-shot="settings-account">
        <AccountSettings shotState={shotState} />
      </Box>
      <Box data-shot="settings-entry">
        <EntryForm shotState={shotState} />
      </Box>
    </SimpleGrid>
  )
}
