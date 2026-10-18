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
 *
 * PAGE-CHROME RULE for this wave, applied to every demo page in the phone-readiness pass and
 * stated once here because this is the first page it touched: **the breadcrumb is the page's one
 * name.** A page body never prints its own `<Title>` — law C8 already reserves the name for the
 * breadcrumb (or `PageBar.title` in a shell-less app), `PageTitle` is the shipped primitive for
 * the shell-less case, and `basalt/in-body-page-title` is the guard that says so. The framing
 * sentence each page carried under that heading is kept, demoted to a lead `<Text size="sm"
 * c="dimmed">` (or a `Section` subtitle where a section already owns the block) — which is what
 * this page and `/dashboard`, `/cbbi`, `/charts` already did. Two chromes competing for ~90px
 * above the first real content is the thing being removed, not the prose.
 */
import {
  Accordion,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Group,
  Menu,
  Popover,
  Radio,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { CONTAINER_KEYS } from 'basalt-ui/tokens'
import { DeltaBadge, EmptyState, PageBar, SettingsSection } from 'basalt-ui'
import { ViewTabs } from 'basalt-ui/controls'
import { noop } from '../scenarios/shot-state'
import type { ShotState } from '../scenarios/shot-state'
import { createLocalStore, field } from 'basalt-ui/state'
import type { ReactNode } from 'react'
import { ActivityPage } from './ActivityPage'
import { IconChevronRight, IconSearch, IconSend } from './icons'
import { PrimitivesPage } from './PrimitivesPage'

type ShotAnchor = 'tabs' | 'badges' | 'table'

// The anchor Box is the grid item now, so the card fills it to keep its row's stretched height.
const FILL = { height: '100%' } as const

/** A titled surface section — every component group sits inside one of these so its surface shows.
 * Named `ComponentGroup`, not `Section`: a local `Section` would shadow the shipped export of that
 * exact name, which `basalt/shadow-basalt-export` flags (law C8). `shot` anchors the group for
 * `basalt-ui shot`, so a change to a global chrome default (badge, subtle button, tabs) is re-shot. */
function ComponentGroup({
  title,
  shot,
  states,
  children,
}: {
  title: string
  shot?: ShotAnchor
  /** The URL states this anchor renders (`data-shot-states`), for a group that has them. */
  states?: string
  children: ReactNode
}) {
  if (shot === undefined) return <SettingsSection title={title}>{children}</SettingsSection>
  return (
    <Box data-shot={shot} data-shot-states={states} h="100%">
      <SettingsSection title={title} style={FILL}>
        {children}
      </SettingsSection>
    </Box>
  )
}

// The route's view switch, store-bound so a deep link and a back navigation land on the tab the
// user left (law C3). `createLocalStore`, not `createSearchStore`: which showcase tab is open is
// not worth a URL param, and the local store mirrors it to localStorage all the same.
const componentViews = createLocalStore({
  key: 'components-view',
  fields: { tab: field.enum(['surfaces', 'primitives', 'activity'], 'surfaces') },
}).labels({
  tab: { surfaces: 'Surfaces', primitives: 'Primitives', activity: 'Activity' },
})

/**
 * `delta` is a percent change, or percentage points for a rate (`pp`); `polarity` says whether a
 * rise is good (churn: it is not). The period lives in the column headers, once.
 */
const TABLE_ROWS = [
  { name: 'Sessions', value: '12,480', prior: '11,104', delta: 12.4, polarity: 'up-good' },
  { name: 'Signups', value: '3,210', prior: '2,969', delta: 8.1, polarity: 'up-good' },
  { name: 'Revenue', value: '$48.9k', prior: '$41.1k', delta: 18.9, polarity: 'up-good' },
  { name: 'Churn rate', value: '2.3%', prior: '2.7%', delta: -0.4, polarity: 'up-bad', pp: true },
] as const

/** The card is as wide as the table's columns need; a wider one leaves the label far from its value. */
const TABLE_MAX_WIDTH = 640

/** Numeric columns align to the end so the digits line up. */
const NUMERIC = { ta: 'right' } as const

export function ComponentsPage({ shotState }: { shotState?: ShotState | undefined }) {
  const [tab] = componentViews.field.tab.use()
  return (
    <Stack gap="md">
      {/* `PageBar` row 1 portals into the app-shell header; the action is typed DATA, so basalt
          owns its size, its overflow fold and its mobile projection (laws C5/C7). The route's tab
          set is row 2's `tabs` slot, which is the only home a bound control may enter (law C1). */}
      <PageBar
        tabs={<ViewTabs field={componentViews.field.tab} label="Section" />}
        actions={[{ key: 'export', label: 'Export', onClick: () => {}, primary: true }]}
      />

      {/* `/primitives` and `/activity` absorbed here (audit E §7) — one PageBar for the whole
          route (law C6), each former page's body unchanged as a panel.

          `Tabs` is CONTROLLED off the store and renders no `Tabs.List` of its own: a raw list is
          `display: flex; flex-wrap: wrap`, so a labelled tab strip breaks onto two lines at 390px
          with the active underline split across rows. `ViewTabs` owns that swap in CSS instead
          (law C9) — a full-width `SegmentedControl` on a phone while the labels fit, a `Select`
          past three options or past the width. The panels stay Mantine's, so `keepMounted`
          behaviour is unchanged. */}
      <Tabs value={tab}>
        <Tabs.Panel value="surfaces">
          <ComponentsSurfaces shotState={shotState} />
        </Tabs.Panel>
        <Tabs.Panel value="primitives">
          <PrimitivesPage />
        </Tabs.Panel>
        <Tabs.Panel value="activity">
          <ActivityPage />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

/** The metrics table at rest, and the three states `basalt-ui shot` reaches through `?shot-state=`. */
function MetricsTable({ shotState }: { shotState?: ShotState | undefined }) {
  if (shotState === 'empty') {
    return (
      <EmptyState
        icon={<IconSearch />}
        title="No metrics in the last 30 days"
        description="Metrics appear here once the first event arrives."
        tier="section"
      />
    )
  }
  if (shotState === 'error') {
    return (
      <EmptyState
        title="Could not load metrics"
        description="Retry, or check the analytics connection."
        action={
          <Button size="xs" variant="default" onClick={noop}>
            Retry
          </Button>
        }
        tier="section"
      />
    )
  }
  return (
    <Table withTableBorder striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Metric</Table.Th>
          <Table.Th {...NUMERIC}>Last 30 d</Table.Th>
          <Table.Th {...NUMERIC}>Prior 30 d</Table.Th>
          <Table.Th {...NUMERIC}>Change</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {shotState === 'loading'
          ? TABLE_ROWS.map((row) => (
              <Table.Tr key={row.name}>
                <Table.Td>
                  <Skeleton height={14} width={120} maw="100%" />
                </Table.Td>
                {[0, 1, 2].map((col) => (
                  <Table.Td key={col} {...NUMERIC}>
                    <Skeleton height={14} width={48} ml="auto" />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          : TABLE_ROWS.map((row) => (
              <Table.Tr key={row.name}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td {...NUMERIC}>{row.value}</Table.Td>
                <Table.Td {...NUMERIC}>{row.prior}</Table.Td>
                <Table.Td {...NUMERIC}>
                  <DeltaBadge
                    value={row.delta}
                    polarity={row.polarity}
                    {...('pp' in row && { format: (v: number) => `${Math.abs(v)} pp` })}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
      </Table.Tbody>
    </Table>
  )
}

export function ComponentsSurfaces({ shotState }: { shotState?: ShotState | undefined }) {
  return (
    <Stack gap="md" data-compare="surfaces">
      {/* Two columns balanced by composition: Buttons runs ~93 px over Inputs and Tabs ~100 px over
          Segmented control, so each column pairs a tall group with a short one and the row ends meet
          within a gap. At 390 the order is buttons, segmented control, inputs, tabs. */}
      <SimpleGrid
        type="container"
        cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}
        style={{ alignItems: 'start' }}
      >
        <Stack gap="md" data-compare-column="buttons">
          {/* One anchor per row: a scored component holds at most three font sizes, and the four
            sizes together are four. */}
          <ComponentGroup title="Button variants and sizes">
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
                </SimpleGrid>
              </Box>
              <Box data-shot="buttons-sizes-small">
                <Group gap="sm" align="center">
                  <Button size="xs" variant="filled" data-shot-hover>
                    Extra small
                  </Button>
                  <Button size="sm">Small</Button>
                </Group>
              </Box>
              <Box data-shot="buttons-sizes-large">
                <Group gap="sm" align="center">
                  <Button size="md" variant="filled" data-shot-hover>
                    Medium
                  </Button>
                  <Button size="lg">Large</Button>
                </Group>
              </Box>
              <Box data-shot="buttons-sections">
                {/* Size-major pairs: two columns where the card fits two, else one, so a row never splits a pair. */}
                <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
                  {(['xs', 'sm', 'md'] as const).flatMap((size) =>
                    (['default', 'filled'] as const).map((variant) => (
                      <Group key={`${size}-${variant}`} gap="sm" align="center" wrap="nowrap">
                        <Button size={size} variant={variant} leftSection={<IconSend />}>
                          Send
                        </Button>
                        <Button size={size} variant={variant} rightSection={<IconChevronRight />}>
                          Next
                        </Button>
                      </Group>
                    )),
                  )}
                </SimpleGrid>
              </Box>
              <Box data-shot="buttons-disabled">
                <Group gap="sm">
                  <Button disabled>Disabled</Button>
                </Group>
              </Box>
            </Stack>
          </ComponentGroup>

          <ComponentGroup title="Segmented control: day, week, month">
            {/* theme-allow control-outside-home — the group's title is the rule's own answer to why:
              the raw control is the specimen. It is uncontrolled and reads nothing, so there is no
              filter here to give a home to. */}
            <SegmentedControl
              data={[
                { label: 'Day', value: 'day' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
              ]}
            />
          </ComponentGroup>
        </Stack>
        <Stack gap="md" data-compare-column="inputs">
          <ComponentGroup title="Inputs: text, select and textarea">
            <Stack gap="sm">
              <TextInput label="Name" placeholder="Jane Doe" />
              {/* theme-allow control-outside-home — this Select IS the specimen: the group's subject
                is how a raw, themed Mantine input renders on a panel surface, beside a TextInput
                and a Textarea, and it carries no state anything else reads. A bound
                `SelectFilter` here would show basalt's control instead of the Mantine one the
                screenshot is for. One of the page's two deliberate waivers; the other is the
                "Segmented control" group in the left column. */}
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
          </ComponentGroup>

          <ComponentGroup title="Tabs: default and pills" shot="tabs">
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
                    14 deploys this week; the last one shipped at 09:12 UTC.
                  </Text>
                </Tabs.Panel>
                <Tabs.Panel value="incidents" pt="sm">
                  <Text size="sm" c="dimmed">
                    One incident in 30 days, resolved in 18 minutes.
                  </Text>
                </Tabs.Panel>
                <Tabs.Panel value="alerts" pt="sm">
                  <Text size="sm" c="dimmed">
                    Alerts page the on-call engineer after two failed checks.
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
          </ComponentGroup>
        </Stack>
      </SimpleGrid>

      <Box maw={TABLE_MAX_WIDTH}>
        <ComponentGroup
          title="Table: metric, value, change"
          shot="table"
          states="empty loading error"
        >
          <MetricsTable shotState={shotState} />
        </ComponentGroup>
      </Box>

      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <ComponentGroup title="Accordion: expandable sections">
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
        </ComponentGroup>

        <ComponentGroup title="Dropdown surfaces: menu and popover">
          {/* The open Menu and Popover are absolutely positioned, so the card reserves their height
              (button, offset and the four-row menu) rather than clipping them at 390. */}
          <Group gap="sm" align="flex-start" mih={220}>
            {/* defaultOpened is showcase-only — kept open so the overlay styling is visible on this
                gallery page; real apps open on trigger, not on mount. */}
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
            {/* defaultOpened is showcase-only — kept open so the overlay styling is visible on this
                gallery page; real apps open on trigger, not on mount. */}
            <Popover defaultOpened position="bottom-start" withArrow withinPortal={false}>
              <Popover.Target>
                <Button variant="default">Popover</Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm">Last synced at 09:12 UTC.</Text>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </ComponentGroup>
      </SimpleGrid>

      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <ComponentGroup title="Status badges and counts" shot="badges">
          <Stack gap="md">
            <Group gap="sm">
              <Badge color="green">Healthy</Badge>
              <Badge color="yellow">Degraded</Badge>
              <Badge color="red">Down</Badge>
            </Group>
            {/* Two rows by design: five in one wrap left "Paused" alone on a second line at 390. */}
            <Group gap="sm">
              <Badge color="orange">Pending</Badge>
              <Badge color="var(--vx-muted)">Paused</Badge>
            </Group>
            <Group gap="sm">
              <Badge
                color="green"
                leftSection={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden="true"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                }
              >
                Verified
              </Badge>
              <Badge variant="filled">12</Badge>
            </Group>
            {/* Light, outline and dot: the three non-default variants, so the group fills the height
                its Code partner sets instead of leaving a void under two rows. */}
            <Group gap="sm">
              <Badge variant="light">Light</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="dot" color="green">
                Dot
              </Badge>
            </Group>
          </Stack>
        </ComponentGroup>

        <ComponentGroup title="Code: inline and block">
          <Stack gap="sm">
            <Text size="sm">
              Inline <Code>VX.line</Code> is a token ref.
            </Text>
            <Code block>{`import { VX } from 'basalt-ui/tokens'\nconst stroke = VX.line`}</Code>
          </Stack>
        </ComponentGroup>

        <ComponentGroup title="Toggles: switch, checkbox and radio">
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
        </ComponentGroup>

        <ComponentGroup title="Empty state: no results">
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
        </ComponentGroup>
      </SimpleGrid>
    </Stack>
  )
}
