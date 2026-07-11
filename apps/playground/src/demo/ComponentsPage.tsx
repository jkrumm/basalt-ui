/**
 * Components page — a dense showcase of the surface-bearing Mantine components, used to
 * screenshot-verify that the theme's surface enforcement holds: every card/panel/dropdown's depth
 * comes from `shadow-card` (a whisper shadow with the ring baked in via `--vx-surface-hairline`),
 * background resolves to `--vx-surface-panel`, hover/subtle to `--vx-surface-subtle`, and the page
 * to `--vx-surface-bg`. `--vx-surface-border`/`line` is reserved for layout dividers, not the
 * card/panel edge.
 *
 * Pure Mantine: only components and layout primitives (Stack / Group / SimpleGrid / Box) — no raw
 * <div>, no inline-styled layout.
 */
import {
  Accordion,
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  Divider,
  Group,
  Menu,
  Paper,
  Popover,
  Radio,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { EmptyState, PageActions } from 'basalt-ui'
import type { ReactNode } from 'react'
import { IconSearch } from './icons'

/** A titled surface section — every component group sits inside one of these so its surface shows. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper p="md">
      <Title order={5} mb="sm">
        {title}
      </Title>
      {children}
    </Paper>
  )
}

const TABLE_ROWS = [
  { name: 'Sessions', value: '12,480', delta: '12.4%' },
  { name: 'Signups', value: '3,210', delta: '8.1%' },
  { name: 'Revenue', value: '$48.9k', delta: '18.9%' },
  { name: 'Churn', value: '2.3%', delta: '-0.4%' },
]

export function ComponentsPage() {
  return (
    <Stack gap="md">
      <PageActions>
        <Button size="xs" variant="default">
          Export
        </Button>
      </PageActions>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Section title="Buttons">
          <Group gap="sm">
            <Button variant="filled">Filled</Button>
            <Button variant="default">Default</Button>
            <Button variant="light">Light</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="subtle">Subtle</Button>
          </Group>
        </Section>

        <Section title="Inputs">
          <Stack gap="sm">
            <TextInput label="Name" placeholder="Jane Doe" />
            <Select
              label="Channel"
              placeholder="Pick one"
              data={[
                { value: 'organic', label: 'Organic' },
                { value: 'paid', label: 'Paid' },
                { value: 'referral', label: 'Referral' },
              ]}
            />
            <Textarea label="Notes" placeholder="A few words…" autosize minRows={2} />
          </Stack>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="activity">Activity</Tabs.Tab>
              <Tabs.Tab value="settings">Settings</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview" pt="sm">
              <Text size="sm" c="dimmed">
                Overview panel content.
              </Text>
            </Tabs.Panel>
            <Tabs.Panel value="activity" pt="sm">
              <Text size="sm" c="dimmed">
                Activity panel content.
              </Text>
            </Tabs.Panel>
            <Tabs.Panel value="settings" pt="sm">
              <Text size="sm" c="dimmed">
                Settings panel content.
              </Text>
            </Tabs.Panel>
          </Tabs>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            data={[
              { label: 'Day', value: 'day' },
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
            ]}
          />
        </Section>
      </SimpleGrid>

      <Section title="Table">
        <Table withTableBorder striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Metric</Table.Th>
              <Table.Th>Value</Table.Th>
              <Table.Th>Delta</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {TABLE_ROWS.map((row) => (
              <Table.Tr key={row.name}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.value}</Table.Td>
                <Table.Td>{row.delta}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Section>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Section title="Accordion">
          <Accordion variant="contained" defaultValue="acquisition">
            <Accordion.Item value="acquisition">
              <Accordion.Control>Acquisition</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed">
                  Where new users come from.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="retention">
              <Accordion.Control>Retention</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed">
                  How many stick around.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="revenue">
              <Accordion.Control>Revenue</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed">
                  What it all adds up to.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Section>

        <Section title="Dropdown surfaces">
          <Group gap="sm">
            <Menu defaultOpened position="bottom-start" withinPortal={false}>
              <Menu.Target>
                <Button variant="default">Menu</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Actions</Menu.Label>
                <Menu.Item>Edit</Menu.Item>
                <Menu.Item>Duplicate</Menu.Item>
                <Menu.Item color="red">Delete</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Popover defaultOpened position="bottom-start" withArrow withinPortal={false}>
              <Popover.Target>
                <Button variant="default">Popover</Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm">Popover content on a panel surface.</Text>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Section>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Section title="Badges & code">
          <Stack gap="sm">
            <Group gap="sm">
              <Badge color="green">Active</Badge>
              <Badge color="gray">Draft</Badge>
              <Badge>Default</Badge>
            </Group>
            <Divider />
            <Text size="sm">
              Inline <Code>useVxTheme()</Code> reads the token refs.
            </Text>
            <Code block>{`import { VX } from 'basalt-ui/charts'\nconst stroke = VX.line`}</Code>
          </Stack>
        </Section>

        <Section title="Toggles">
          <Stack gap="sm">
            <Switch label="Enable notifications" defaultChecked />
            <Checkbox label="I agree to the terms" defaultChecked />
            <Radio.Group label="Plan" defaultValue="pro">
              <Group gap="md" mt="xs">
                <Radio value="free" label="Free" />
                <Radio value="pro" label="Pro" />
                <Radio value="team" label="Team" />
              </Group>
            </Radio.Group>
          </Stack>
        </Section>
      </SimpleGrid>

      <Section title="Empty state">
        <EmptyState
          icon={<IconSearch />}
          title="No results"
          description="Try adjusting your filters or search terms."
          action={
            <Button size="xs" variant="default">
              Clear filters
            </Button>
          }
          variant="section"
        />
      </Section>

      <Card p="md">
        <Text size="sm" c="dimmed">
          A <Code>Card</Code> surface — same shadow-card, background, and radius as every Paper
          above.
        </Text>
      </Card>
    </Stack>
  )
}
