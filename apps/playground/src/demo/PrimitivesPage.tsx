/**
 * PrimitivesPage — the two Mantine-free primitives everything else composes, exercised directly
 * (audit-b-components.md #16: `WidgetHeader`/`DeltaBadge` had zero playground coverage before this
 * route).
 *
 * `WidgetHeader` at all three tiers (`section`/`widget`/`group`) × the full prop set — title,
 * subtitle, icon, info, value, unit, delta (+ polarity/format/glyph/period), count,
 * actions. `DeltaBadge` both polarities, zero, and no-glyph, standalone.
 */
import type { ReactNode } from 'react'
import { Button, Group, Paper, Stack, Text } from '@mantine/core'
import { DeltaBadge, WidgetHeader } from 'basalt-ui'
import { IconChart } from './icons'

function Card({ children }: { children: ReactNode }) {
  return (
    <Paper p="sm" withBorder>
      {children}
    </Paper>
  )
}

function WidgetHeaderTierBlock() {
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        The one heading primitive behind every section, card and table title — three tiers, all the
        way through the full prop set (title/subtitle/icon/info/value/unit/delta family/count/
        actions).
      </Text>

      <Card>
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          tier=&quot;section&quot; — the page-level heading
        </Text>
        <WidgetHeader
          tier="section"
          icon={<IconChart />}
          title="Revenue"
          subtitle="Trailing 30 days, all channels"
          info="This is the info glyph — it opens on hover, focus, and click, and closes on Escape or an outside pointer-down."
          value="48,204"
          unit="USD"
          delta={3.1}
          deltaPeriod="MoM"
          count={12}
          actions={<Button variant="subtle">Export</Button>}
        />
      </Card>

      <Card>
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          tier=&quot;widget&quot; — the card heading, with a bad-is-up delta
        </Text>
        <WidgetHeader
          tier="widget"
          icon={<IconChart />}
          title="Cycle-top risk"
          subtitle='A rise here is the WORSE reading — deltaPolarity="up-bad"'
          value="0.62"
          delta={4.4}
          deltaPolarity="up-bad"
          deltaPeriod="WoW"
          actions={<Button variant="subtle">Pin to top</Button>}
        />
      </Card>

      <Card>
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          tier=&quot;group&quot; — the quietest heading rank (aside/inspector group label), a custom
          deltaFormat printing its own sign, and deltaGlyph=false so the ▼ doesn&apos;t repeat it
        </Text>
        <WidgetHeader
          tier="group"
          title="Pace"
          value="0:12 /km"
          delta={-8}
          deltaFormat={(v) =>
            `${v > 0 ? '+' : '−'}0:${Math.abs(v).toString().padStart(2, '0')} /km`
          }
          deltaGlyph={false}
          count={0}
        />
      </Card>
    </Stack>
  )
}

function DeltaBadgeBlock() {
  return (
    <Card>
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
        DeltaBadge — standalone, both polarities, zero, and glyph-off
      </Text>
      <Group gap="lg">
        <DeltaBadge value={12.4} />
        <DeltaBadge value={-3.1} />
        <DeltaBadge value={0} />
        <DeltaBadge value={35.9} polarity="up-bad" />
        <DeltaBadge value={182} format={(v) => `${Math.abs(v)}ms`} withGlyph={false} />
        <DeltaBadge value={-2.5} polarity="neutral" />
      </Group>
    </Card>
  )
}

export function PrimitivesPage() {
  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        The primitives every heading, card, table and shell surface composes — exercised directly
        rather than only glimpsed inside a bigger composer.
      </Text>
      <WidgetHeaderTierBlock />
      <DeltaBadgeBlock />
    </Stack>
  )
}
