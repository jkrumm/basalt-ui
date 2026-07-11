import {
  Code,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { scenarioToAccountState, useUserScenario } from './user-scenario-store'
import type { UserScenario } from './user-scenario-store'

/** A labeled `SegmentedControl` row bound directly to one scenario field — no local state, the
 * store is the single source of truth so the sidebar footer re-renders live on every change. */
function ScenarioToggle<K extends keyof UserScenario>({
  label,
  field,
  data,
  scenario,
  setScenario,
}: {
  label: string
  field: K
  data: Array<{ label: string; value: UserScenario[K] & string }>
  scenario: UserScenario
  setScenario: (next: UserScenario) => void
}) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" style={{ minWidth: 120 }}>
        {label}
      </Text>
      <SegmentedControl
        size="xs"
        data={data}
        value={scenario[field] as string}
        onChange={(value) => setScenario({ ...scenario, [field]: value })}
      />
    </Group>
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

      <Paper p="md">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Session
          </Text>
          <ScenarioToggle
            label="Auth"
            field="auth"
            scenario={scenario}
            setScenario={setScenario}
            data={[
              { label: 'Loading', value: 'loading' },
              { label: 'Signed out', value: 'signed-out' },
              { label: 'Signed in', value: 'signed-in' },
            ]}
          />
          <ScenarioToggle
            label="Role"
            field="role"
            scenario={scenario}
            setScenario={setScenario}
            data={[
              { label: 'User', value: 'user' },
              { label: 'Admin', value: 'admin' },
              { label: 'Owner', value: 'owner' },
            ]}
          />
        </Stack>
      </Paper>

      <Paper p="md">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Plan
          </Text>
          <ScenarioToggle
            label="Plan"
            field="plan"
            scenario={scenario}
            setScenario={setScenario}
            data={[
              { label: 'Free', value: 'free' },
              { label: 'Pro', value: 'pro' },
              { label: 'Team', value: 'team' },
            ]}
          />
          <ScenarioToggle
            label="Plan status"
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
        </Stack>
      </Paper>

      <Paper p="md">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Identity
          </Text>
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
      </Paper>

      <Divider />

      <Paper p="md">
        <Text size="sm" fw={500} mb="xs">
          Derived BasaltAccountState
        </Text>
        <Code block>{JSON.stringify(accountState, null, 2)}</Code>
      </Paper>
    </Stack>
  )
}
