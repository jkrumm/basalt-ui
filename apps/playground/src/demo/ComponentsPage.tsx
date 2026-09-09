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
  Button,
  Card,
  Checkbox,
  Code,
  Divider,
  Group,
  Menu,
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
} from '@mantine/core'
import { EmptyState, PageBar, SettingsSection } from 'basalt-ui'
import { ViewTabs } from 'basalt-ui/controls'
import { createLocalStore, field } from 'basalt-ui/state'
import type { ReactNode } from 'react'
import { ActivityPage } from './ActivityPage'
import { IconSearch } from './icons'
import { PrimitivesPage } from './PrimitivesPage'

/** A titled surface section — every component group sits inside one of these so its surface shows.
 * Named `ComponentGroup`, not `Section`: a local `Section` would shadow the shipped export of that
 * exact name, which `basalt/shadow-basalt-export` flags (law C8). */
function ComponentGroup({ title, children }: { title: string; children: ReactNode }) {
  return <SettingsSection title={title}>{children}</SettingsSection>
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

const TABLE_ROWS = [
  { name: 'Sessions', value: '12,480', delta: '12.4%' },
  { name: 'Signups', value: '3,210', delta: '8.1%' },
  { name: 'Revenue', value: '$48.9k', delta: '18.9%' },
  { name: 'Churn', value: '2.3%', delta: '-0.4%' },
]

export function ComponentsPage() {
  const [tab] = componentViews.field.tab.use()
  return (
    <Stack gap="md">
      {/* `PageBar` row 1 portals into the app-shell header; the action is typed DATA, so basalt
          owns its size, its overflow fold and its mobile projection (laws C5/C7). The route's tab
          set is row 2's `tabs` slot, which is the only home a bound control may enter (law C1). */}
      <PageBar
        tabs={<ViewTabs field={componentViews.field.tab} label="Section" />}
        actions={{ secondary: [{ key: 'export', label: 'Export', onClick: () => {} }] }}
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
          <ComponentsSurfaces />
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

function ComponentsSurfaces() {
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ComponentGroup title="Buttons">
          <Group gap="sm">
            <Button variant="filled">Filled</Button>
            <Button variant="default">Default</Button>
            <Button variant="light">Light</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="subtle">Subtle</Button>
          </Group>
        </ComponentGroup>

        <ComponentGroup title="Inputs">
          <Stack gap="sm">
            <TextInput label="Name" placeholder="Jane Doe" />
            {/* theme-allow control-outside-home — this Select IS the specimen: the group's subject
                is how a raw, themed Mantine input renders on a panel surface, beside a TextInput
                and a Textarea, and it carries no state anything else reads. A bound
                `SelectFilter` here would show basalt's control instead of the Mantine one the
                screenshot is for. One of the page's two deliberate waivers; the other is the
                "Segmented control" group below. */}
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

        <ComponentGroup title="Tabs">
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
        </ComponentGroup>

        <ComponentGroup title="Segmented control">
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
      </SimpleGrid>

      <ComponentGroup title="Table">
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
      </ComponentGroup>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ComponentGroup title="Accordion">
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

        <ComponentGroup title="Dropdown surfaces">
          <Group gap="sm">
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
                <Text size="sm">Popover content on a panel surface.</Text>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </ComponentGroup>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ComponentGroup title="Badges & code">
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
        </ComponentGroup>

        <ComponentGroup title="Toggles">
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
      </SimpleGrid>

      <ComponentGroup title="Empty state">
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

      <Card py="xs" px="sm">
        <Text size="sm" c="dimmed">
          A <Code>Card</Code> surface — same shadow-card, background, and radius as every Paper
          above.
        </Text>
      </Card>
    </Stack>
  )
}
