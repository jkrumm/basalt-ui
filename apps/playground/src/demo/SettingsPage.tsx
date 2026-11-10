import { Badge, Group, Stack, Text } from '@mantine/core'
import { SettingsRow, SettingsSection } from 'basalt-ui'
import { UserStatePage } from './UserStatePage'
import { scenarioToAccountState, scenarioToPlan, useUserScenario } from './user-scenario-store'

/**
 * The persisted-state demo. `id="account"` / `id="billing"` are the hash targets the account menu
 * in `routes/__root.tsx` deep-links to; the controls below write the persisted scenario store.
 */
export function SettingsPage() {
  const [scenario] = useUserScenario()
  const account = scenarioToAccountState(scenario)
  const plan = scenarioToPlan(scenario)

  return (
    <Stack gap="md" maw={840} mx="auto">
      <div id="account">
        <SettingsSection title="Account" subtitle="Your profile and access.">
          <SettingsRow
            label="Status"
            description="Derived from the scenario below."
            control={<Badge variant="light">{account.status}</Badge>}
          />
        </SettingsSection>
      </div>
      <div id="billing">
        <SettingsSection title="Billing" subtitle="Plan and payment status.">
          <SettingsRow
            label="Plan"
            description="Change it in the scenario below."
            control={
              <Group gap="xs">
                <Text size="sm">{plan.label}</Text>
                <Badge variant="light">{scenario.planStatus}</Badge>
              </Group>
            }
          />
        </SettingsSection>
      </div>
      <UserStatePage />
    </Stack>
  )
}
