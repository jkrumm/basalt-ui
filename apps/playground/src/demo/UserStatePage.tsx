import { Code, Divider, SegmentedControl, Stack, Text, TextInput, Title } from '@mantine/core'
import { SettingsRow, SettingsSection } from 'basalt-ui'
import { scenarioToAccountState, useUserScenario } from './user-scenario-store'
import type { UserScenario } from './user-scenario-store'

/** A `SegmentedControl` bound directly to one scenario field — no local state, the store is the
 * single source of truth so the sidebar footer re-renders live on every change. Rendered as a
 * `SettingsRow` control by the call sites below. */
function ScenarioToggle<K extends keyof UserScenario>({
  field,
  data,
  scenario,
  setScenario,
}: {
  field: K
  data: Array<{ label: string; value: UserScenario[K] & string }>
  scenario: UserScenario
  setScenario: (next: UserScenario) => void
}) {
  return (
    <SegmentedControl
      size="xs"
      data={data}
      value={scenario[field] as string}
      onChange={(value) => setScenario({ ...scenario, [field]: value })}
    />
  )
}

export function UserStatePage() {
  const [scenario, setScenario] = useUserScenario()
  const accountState = scenarioToAccountState(scenario)

  return (
    <Stack gap="lg" p="md" maw={600}>
      <Title order={2}>User Simulator</Title>
      <Text size="sm" c="dimmed">
        Toggle auth/plan/role state to see the sidebar footer&apos;s <Code>SidebarAccount</Code>{' '}
        react live — including the Account/Billing drawers behind its menu.
      </Text>

      <SettingsSection title="Session">
        <SettingsRow
          label="Auth"
          control={
            <ScenarioToggle
              field="auth"
              scenario={scenario}
              setScenario={setScenario}
              data={[
                { label: 'Loading', value: 'loading' },
                { label: 'Signed out', value: 'signed-out' },
                { label: 'Signed in', value: 'signed-in' },
              ]}
            />
          }
        />
        <SettingsRow
          label="Role"
          control={
            <ScenarioToggle
              field="role"
              scenario={scenario}
              setScenario={setScenario}
              data={[
                { label: 'User', value: 'user' },
                { label: 'Admin', value: 'admin' },
                { label: 'Owner', value: 'owner' },
              ]}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Plan">
        <SettingsRow
          label="Plan"
          control={
            <ScenarioToggle
              field="plan"
              scenario={scenario}
              setScenario={setScenario}
              data={[
                { label: 'Free', value: 'free' },
                { label: 'Pro', value: 'pro' },
                { label: 'Team', value: 'team' },
              ]}
            />
          }
        />
        <SettingsRow
          label="Plan status"
          control={
            <ScenarioToggle
              field="planStatus"
              scenario={scenario}
              setScenario={setScenario}
              data={[
                { label: 'Active', value: 'active' },
                { label: 'Trialing', value: 'trialing' },
                { label: 'Past due', value: 'past_due' },
                { label: 'Canceled', value: 'canceled' },
              ]}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Identity">
        <Stack gap="xs">
          <TextInput
            size="xs"
            label="Name"
            value={scenario.name}
            onChange={(e) => setScenario({ ...scenario, name: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Email"
            value={scenario.email}
            onChange={(e) => setScenario({ ...scenario, email: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Image URL"
            placeholder="(empty falls back to initials)"
            value={scenario.image}
            onChange={(e) => setScenario({ ...scenario, image: e.currentTarget.value })}
          />
        </Stack>
      </SettingsSection>

      <Divider />

      <SettingsSection title="Derived BasaltAccountState">
        <Code block>{JSON.stringify(accountState, null, 2)}</Code>
      </SettingsSection>
    </Stack>
  )
}
