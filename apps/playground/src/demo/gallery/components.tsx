import {
  Accordion,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
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
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
} from '@mantine/core'
import { DeltaBadge, EmptyState, Section, WidgetHeader } from 'basalt-ui'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import type { ReactNode } from 'react'
import { queryFor, retryCopy } from '../../scenarios/shot-state'
import type { ShotState } from '../../scenarios/shot-state'
import { IconChart, IconChevronRight, IconSearch, IconSend } from '../icons'

type ShotAnchor = 'tabs' | 'badges' | 'table'

/** One gallery block; `shot` anchors it for `basalt-ui shot`. */
function Block({
  title,
  shot,
  states,
  children,
}: {
  title: string
  shot?: ShotAnchor
  states?: string
  children: ReactNode
}) {
  const section = <Section title={title}>{children}</Section>
  if (shot === undefined) return section
  return (
    <Box data-shot={shot} data-shot-states={states} h="100%">
      {section}
    </Box>
  )
}

const ROWS = [
  { name: 'Sessions', value: '12,480', prior: '11,104', delta: 12.4, polarity: 'up-good' },
  { name: 'Signups', value: '3,210', prior: '2,969', delta: 8.1, polarity: 'up-good' },
  { name: 'Churn rate', value: '2.3%', prior: '2.7%', delta: -0.4, polarity: 'up-bad', pp: true },
] as const

const metric = createColumnHelper<(typeof ROWS)[number]>()
const COLUMNS = [
  metric.accessor('name', { header: 'Metric', meta: { kind: 'entity' } }),
  metric.accessor('value', {
    header: 'Last 30 d',
    enableSorting: false,
    cell: (info) => info.getValue(),
    meta: { kind: 'number' },
  }),
  metric.accessor('prior', {
    header: 'Prior 30 d',
    enableSorting: false,
    cell: (info) => info.getValue(),
    meta: { kind: 'number' },
  }),
  metric.accessor('delta', {
    header: 'Change',
    cell: ({ row }) => (
      <DeltaBadge
        value={row.original.delta}
        polarity={row.original.polarity}
        {...('pp' in row.original && { format: (v: number) => `${Math.abs(v)} pp` })}
      />
    ),
    meta: { kind: 'number' },
  }),
]

function MetricsTable({ shotState }: { shotState: ShotState | undefined }) {
  const query = queryFor(shotState, retryCopy('analytics service'))
  return (
    <BasaltDataTable
      data={shotState === undefined ? ROWS.slice() : []}
      columns={COLUMNS}
      striped
      skeletonRows={ROWS.length}
      {...(query !== undefined && { query })}
      emptyState={
        <EmptyState
          icon={<IconSearch />}
          title="No metrics in the last 30 days"
          description="Metrics appear here once the first event arrives."
          tier="section"
        />
      }
    />
  )
}

const EVENTS = [
  ['Deployment shipped to production', 'Just now', 'v2.4.0 rolled out to all regions.'],
  ['New signup: Clara Bauer', '12 min ago', 'Joined via the referral program.'],
  ['Payment received', '1 hour ago', '$1,240 invoice settled for the Pro plan.'],
] as const

const SELECT_DATA = [
  { value: 'organic', label: 'Organic' },
  { value: 'paid', label: 'Paid' },
]

export function ComponentsSection({ shotState }: { shotState: ShotState | undefined }) {
  return (
    <Stack gap="md" data-compare="surfaces">
      <SimpleGrid
        type="container"
        cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}
        style={{ alignItems: 'start' }}
      >
        <Stack gap="md" data-compare-column="buttons">
          <Block title="Buttons">
            <Stack gap="sm">
              <Box data-shot="buttons-variants">
                <SimpleGrid cols={3} spacing="sm">
                  <Button fullWidth variant="filled">
                    Filled
                  </Button>
                  <Button fullWidth variant="default">
                    Default
                  </Button>
                  <Button fullWidth variant="light" data-shot-hover>
                    Light
                  </Button>
                  <Button fullWidth variant="outline">
                    Outline
                  </Button>
                  <Button fullWidth variant="subtle">
                    Subtle
                  </Button>
                  <Button fullWidth disabled>
                    Disabled
                  </Button>
                </SimpleGrid>
              </Box>
              <Box data-shot="buttons-sizes-small">
                <Group gap="sm" align="center">
                  <Button size="xs" data-shot-hover>
                    Extra small
                  </Button>
                  <Button size="sm">Small</Button>
                </Group>
              </Box>
              <Box data-shot="buttons-sizes-large">
                <Group gap="sm" align="center">
                  <Button size="md" data-shot-hover>
                    Medium
                  </Button>
                  <Button size="lg">Large</Button>
                </Group>
              </Box>
              <Box data-shot="buttons-sections">
                <Group gap="sm" align="center" wrap="nowrap">
                  <Button variant="default" leftSection={<IconSend />}>
                    Send
                  </Button>
                  <Button rightSection={<IconChevronRight />}>Next</Button>
                </Group>
              </Box>
            </Stack>
          </Block>
          <Block title="Segmented control">
            {/* theme-allow control-outside-home — the raw control is the specimen. */}
            <SegmentedControl
              data={[
                { label: 'Day', value: 'day' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
              ]}
            />
          </Block>
        </Stack>
        <Stack gap="md" data-compare-column="inputs">
          <Block title="Inputs">
            <Stack gap="sm">
              <TextInput label="Name" placeholder="Jane Doe" />
              {/* theme-allow control-outside-home — the raw Select is the specimen. */}
              <Select label="Channel" placeholder="Pick one" data={SELECT_DATA} />
              <Textarea label="Notes" placeholder="A few words…" autosize minRows={2} />
            </Stack>
          </Block>
          <Block title="Tabs" shot="tabs">
            <Stack gap="md">
              <Tabs defaultValue="deploys">
                <Tabs.List>
                  <Tabs.Tab value="deploys">Deploys</Tabs.Tab>
                  <Tabs.Tab value="incidents" data-shot-hover>
                    Incidents
                  </Tabs.Tab>
                  <Tabs.Tab value="alerts">Alerts</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="deploys" pt="sm">
                  <Text size="sm" c="dimmed">
                    14 deploys this week.
                  </Text>
                </Tabs.Panel>
              </Tabs>
              <Tabs defaultValue="all" variant="pills">
                <Tabs.List>
                  <Tabs.Tab value="all">All</Tabs.Tab>
                  <Tabs.Tab value="open">Open</Tabs.Tab>
                  <Tabs.Tab value="closed">Closed</Tabs.Tab>
                </Tabs.List>
              </Tabs>
            </Stack>
          </Block>
        </Stack>
      </SimpleGrid>

      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <Box
          data-shot="table"
          data-shot-states="empty loading error"
          style={{ alignSelf: 'start' }}
        >
          <Section title="Table">
            <MetricsTable shotState={shotState} />
          </Section>
        </Box>
        <Block title="Accordion">
          <Accordion variant="contained" defaultValue="acquisition">
            {(['Acquisition', 'Retention', 'Revenue'] as const).map((name) => (
              <Accordion.Item key={name} value={name.toLowerCase()}>
                <Accordion.Control>{name}</Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" c="dimmed">
                    {name} details.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Block>
        <Block title="Menu and popover">
          <Group gap="sm" align="flex-start" mih={200}>
            <Menu defaultOpened position="bottom-start" withinPortal={false}>
              <Menu.Target>
                <Button variant="default">Menu</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Actions</Menu.Label>
                <Menu.Item>Edit</Menu.Item>
                <Menu.Item color="red">Delete</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Popover defaultOpened position="bottom-start" withArrow withinPortal={false}>
              <Popover.Target>
                <Button variant="default">Popover</Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm">Last synced at 09:12 UTC.</Text>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Block>
        <Block title="Badges" shot="badges">
          <Stack gap="md">
            <Group gap="sm">
              <Badge color="green">Healthy</Badge>
              <Badge color="yellow">Degraded</Badge>
              <Badge color="red">Down</Badge>
            </Group>
            <Group gap="sm">
              <Badge color="orange">Pending</Badge>
              <Badge color="var(--vx-muted)">Paused</Badge>
              <Badge variant="filled">12</Badge>
            </Group>
            <Group gap="sm">
              <Badge variant="light">Light</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="dot" color="green">
                Dot
              </Badge>
            </Group>
          </Stack>
        </Block>
        <Block title="Code">
          <Stack gap="sm">
            <Text size="sm">
              Inline <Code>VX.line</Code> is a token ref.
            </Text>
            <Code block>{`import { VX } from 'basalt-ui/tokens'\nconst stroke = VX.line`}</Code>
          </Stack>
        </Block>
        <Block title="Toggles">
          <Stack gap="sm">
            <Switch label="Enable notifications" defaultChecked />
            <Checkbox label="I agree to the terms" defaultChecked />
            <Radio.Group label="Plan" defaultValue="pro">
              <Group gap="md" mt="xs">
                <Radio value="free" label="Free" />
                <Radio value="pro" label="Pro" />
              </Group>
            </Radio.Group>
          </Stack>
        </Block>
        <Block title="Empty state">
          <EmptyState
            icon={<IconSearch />}
            title="No results"
            description="Try adjusting your filters or search terms."
            action={
              <Button size="xs" variant="default">
                Clear filters
              </Button>
            }
            tier="section"
          />
        </Block>
      </SimpleGrid>

      <Block title="Widget header and delta badge">
        <Stack gap="sm">
          <Paper>
            <WidgetHeader
              tier="section"
              icon={<IconChart />}
              title="Revenue"
              subtitle="Trailing 30 days, all channels"
              info="The info glyph opens on hover, focus and click."
              value="48,204"
              unit="USD"
              delta={3.1}
              deltaPeriod="last month"
              count={12}
              actions={<Button variant="subtle">Export</Button>}
            />
          </Paper>
          <Paper>
            <WidgetHeader
              tier="widget"
              title="Cycle-top risk"
              value="0.62"
              delta={4.4}
              deltaPolarity="up-bad"
              deltaPeriod="last week"
            />
          </Paper>
          <Paper>
            <WidgetHeader
              tier="group"
              title="Pace"
              value="0:12 /km"
              delta={-8}
              deltaFormat={(v) => `${v > 0 ? '+' : '−'}0:${Math.abs(v)} /km`}
              deltaGlyph={false}
              count={0}
            />
          </Paper>
          <Group gap="lg">
            <DeltaBadge value={12.4} />
            <DeltaBadge value={0} />
            <DeltaBadge value={35.9} polarity="up-bad" />
            <DeltaBadge value={182} format={(v) => `${Math.abs(v)}ms`} withGlyph={false} />
            <DeltaBadge value={-2.5} polarity="neutral" />
          </Group>
        </Stack>
      </Block>

      <Block title="Activity timeline">
        <Paper data-compare="activity">
          <Timeline active={0}>
            {EVENTS.map(([title, timestamp, description]) => (
              <Timeline.Item key={title} title={title}>
                <Text
                  style={{
                    fontFamily: 'var(--basalt-font-mono)',
                    fontSize: VX.text.micro,
                    color: VX.faint,
                  }}
                >
                  {timestamp}
                </Text>
                <Text size="sm" c="dimmed" mt={2}>
                  {description}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Paper>
      </Block>
    </Stack>
  )
}
