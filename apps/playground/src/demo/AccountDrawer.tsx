/**
 * Account management drawer — playground demo of what a consumer app might build behind
 * `onManageAccount`. Profile fields write straight to the scenario store, so edits reflect live
 * in the sidebar footer. Security section is a stubbed, inert illustration; Danger zone signs the
 * demo user out.
 */
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useUserScenario } from './user-scenario-store'

export function AccountDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [scenario, setScenario] = useUserScenario()

  return (
    <Drawer opened={opened} onClose={onClose} title="Account settings" position="right">
      <Stack gap="lg">
        <Group>
          <Avatar
            src={scenario.image === '' ? null : scenario.image}
            name={scenario.name}
            color="initials"
            radius="xl"
            size="lg"
          />
          <Stack gap={2}>
            <Text fw={500}>{scenario.name}</Text>
            <Badge size="xs" variant="light" color="teal">
              Email verified
            </Badge>
          </Stack>
        </Group>

        <Stack gap="xs">
          <TextInput
            label="Name"
            value={scenario.name}
            onChange={(e) => setScenario({ ...scenario, name: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            value={scenario.email}
            onChange={(e) => setScenario({ ...scenario, email: e.currentTarget.value })}
          />
        </Stack>

        <Divider label="Security" labelPosition="left" />
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm">Change password</Text>
            <Button size="compact-xs" variant="default" disabled>
              Change
            </Button>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Active sessions</Text>
            <Button size="compact-xs" variant="default" disabled>
              View
            </Button>
          </Group>
        </Stack>

        <Divider label="Danger zone" labelPosition="left" />
        <Button
          color="red"
          variant="light"
          onClick={() => {
            setScenario({ ...scenario, auth: 'signed-out' })
            onClose()
          }}
        >
          Delete account
        </Button>
      </Stack>
    </Drawer>
  )
}
