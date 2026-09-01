/**
 * DataTableChromeDemoPage — the body chrome that kept three argo tables hand-rolled:
 * `maxHeight` (a capped, scrolling body), `stickyHeader`, and per-column `meta.align`.
 *
 * `maxHeight` renders Mantine's `Table.ScrollContainer type="native"` — the SAME node the docs
 * sanction as the raw escape hatch for a bespoke table. The blessed lane and the escape produce
 * identical DOM, which is the whole reason `stickyHeader` works here: `type="scrollarea"` would
 * make ScrollArea's viewport the positioning context and pin the header to the page instead.
 *
 * The "bad alignment" switch pushes `meta: { align: 'end' }` — a value the union rejects at
 * compile time and the component throws on at runtime, rather than quietly left-aligning money.
 */
import { ActionIcon, Alert, Card, Code, Group, Menu, Stack, Switch } from '@mantine/core'
import { Section } from 'basalt-ui'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data/table'
import type { DataTableAlign } from 'basalt-ui/data/table'
import { Component, useMemo, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Session = {
  when: string
  distanceKm: number
  durationMin: number
  steps: number
  kcal: number
}

const SESSIONS: Session[] = Array.from({ length: 40 }, (_, i) => ({
  when: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
  distanceKm: Number((2 + (i % 7) * 0.63).toFixed(2)),
  durationMin: 24 + (i % 11) * 3,
  steps: 3200 + i * 137,
  kcal: 90 + (i % 9) * 11,
}))

const col = createColumnHelper<Session>()

// Heterogeneous ColumnDef<Session, any>[] — each accessor keeps its own inferred value type.
function buildColumns(align: DataTableAlign) {
  const numeric = { align }
  return [
    col.accessor('when', { header: 'When' }),
    col.accessor('distanceKm', { header: 'Distance (km)', meta: numeric }),
    col.accessor('durationMin', { header: 'Duration (min)', meta: numeric }),
    col.accessor('steps', { header: 'Steps', meta: numeric }),
    col.accessor('kcal', { header: 'Kcal', meta: numeric }),
  ]
}

/** Catches the deliberate throw so the page stays usable while demonstrating it. */
class ThrowBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  override state = { message: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }
  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The demo shows the message in-page; nothing to report.
  }
  override render() {
    if (this.state.message !== null)
      return (
        <Alert color="orange" variant="light" title="BasaltDataTable threw — as designed">
          <Code block>{this.state.message}</Code>
        </Alert>
      )
    return this.props.children
  }
}

export function DataTableChromeDemoPage() {
  const [capped, setCapped] = useState(true)
  const [sticky, setSticky] = useState(true)
  const [aligned, setAligned] = useState(true)
  const [bad, setBad] = useState(false)

  // `'end'` is the CSS word, not the token — the cast is how the demo reaches the runtime throw
  // that a plain literal would not compile.
  const columns = useMemo(
    () => buildColumns(bad ? ('end' as DataTableAlign) : aligned ? 'right' : 'left'),
    [aligned, bad],
  )

  return (
    <Stack gap="lg">
      {/* The flags are the section's `actions` slot, not an ephemeral row in the body (law C1), and
          none of them carries a `size` because the home sets the tier (law C5).
          THREE of them, not four: a `Section` holds ≤3 actions (law C6), and four labelled switches
          in a `wrap: nowrap` row measure past a 375px viewport — which law C7 forbids a home from
          scrolling or wrapping out of. The fourth, rarest one folds into a kebab, which is exactly
          the fold basalt would compute for a typed `BarAction[]`. */}
      <Section
        title="Data table — capped body, sticky header, column alignment"
        subtitle="40 rows in a card that must not grow past 320px."
        actions={
          <Group gap="lg" wrap="nowrap">
            <Switch
              label="maxHeight 320"
              checked={capped}
              onChange={(event) => setCapped(event.currentTarget.checked)}
            />
            <Switch
              label="stickyHeader"
              checked={sticky}
              onChange={(event) => setSticky(event.currentTarget.checked)}
            />
            <Switch
              label="Right-aligned"
              checked={aligned}
              onChange={(event) => setAligned(event.currentTarget.checked)}
            />
            <Menu position="bottom-end" withinPortal shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="More table options">
                  ⋯
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color="orange"
                  onClick={() => setBad(!bad)}
                  aria-pressed={bad}
                  closeMenuOnClick={false}
                >
                  {bad ? '✓ ' : ''}Bad align value (&apos;end&apos;)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        }
      >
        {/* theme-allow card-inset — flush table card: the header row and the scroll body manage
            their own px/py so the capped body can scroll edge to edge under a sticky header.
            withTableBorder={false} because the Card already owns the frame. The title and the
            count are the TABLE's own (law C11) — `count` is always `table.getRowCount()`, so it
            cannot drift from the rows actually rendered the way a hand-written label could. */}
        <Card padding={0}>
          <ThrowBoundary key={String(bad)}>
            <BasaltDataTable
              title="Session history"
              data={SESSIONS}
              columns={columns}
              striped
              highlightOnHover
              verticalSpacing="xs"
              withTableBorder={false}
              minWidth={640}
              stickyHeader={sticky}
              {...(capped && { maxHeight: 320 })}
            />
          </ThrowBoundary>
        </Card>
      </Section>
    </Stack>
  )
}
