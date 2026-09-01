/**
 * PrimitivesPage — the two Mantine-free primitives everything else composes, exercised directly
 * (audit-b-components.md #16: `WidgetHeader`/`DeltaBadge`/`OverflowMenu`/`SidebarSearch`/`MOTION_*`
 * had zero playground coverage before this route).
 *
 * `WidgetHeader` at all three tiers (`section`/`widget`/`group`) × the full prop set — title,
 * subtitle, icon, info, value, unit, delta (+ polarity/format/glyph/period), count, sparkline,
 * actions. `DeltaBadge` both polarities, zero, and no-glyph, standalone. `OverflowMenu` and
 * `SidebarSearch` standalone (both otherwise only ever seen wired into `BasaltShell`). The three
 * `MOTION_*` constants driving a toggling element, since nothing in the playground had used them.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Group, Paper, Stack, Switch, Text } from '@mantine/core'
import {
  DeltaBadge,
  MOTION_DURATION,
  MOTION_EASE_STANDARD,
  MOTION_SPRING,
  SidebarSearch,
  WidgetHeader,
} from 'basalt-ui'
import { OverflowMenu } from 'basalt-ui/controls'
import { LineSparkline, VX } from 'basalt-ui/charts'
import { motion } from 'motion/react'
import { IconChart, IconDots, IconSettings, IconTrash } from './icons'

const SPARK_DATA = [4, 6, 5, 8, 7, 9, 8, 11, 10, 13, 12, 15]

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
        sparkline/actions).
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
          actions={
            <OverflowMenu actions={[{ key: 'export', label: 'Export', onClick: () => {} }]} />
          }
        />
      </Card>

      <Card>
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          tier=&quot;widget&quot; — the card heading, with a sparkline and a bad-is-up delta
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
          sparkline={<LineSparkline data={SPARK_DATA} width={96} height={28} color={VX.line} />}
          actions={
            <OverflowMenu
              trigger="kebab"
              actions={[{ key: 'pin', label: 'Pin to top', onClick: () => {} }]}
            />
          }
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

function OverflowMenuBlock() {
  return (
    <Card>
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
        OverflowMenu — standalone, both triggers
      </Text>
      <Group gap="lg">
        <OverflowMenu
          actions={[
            { key: 'export', label: 'Export', icon: <IconChart />, onClick: () => {} },
            { key: 'settings', label: 'Settings', icon: <IconSettings />, onClick: () => {} },
            {
              key: 'delete',
              label: 'Delete',
              icon: <IconTrash />,
              danger: true,
              onClick: () => {},
            },
          ]}
        />
        <OverflowMenu
          trigger="kebab"
          label="More options"
          actions={[
            { key: 'a', label: 'Action A', onClick: () => {} },
            { key: 'b', label: 'Action B', onClick: () => {} },
          ]}
        />
      </Group>
    </Card>
  )
}

function SidebarSearchBlock() {
  return (
    <Card>
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
        SidebarSearch — standalone (normally only seen wired into BasaltShell&apos;s brand row)
      </Text>
      <Stack gap="xs" maw={280}>
        <SidebarSearch onOpen={() => {}} />
        <SidebarSearch
          onOpen={() => {}}
          placeholder="Find anything"
          actions={[{ key: 'settings', label: 'Settings', icon: <IconDots />, onClick: () => {} }]}
        />
        <SidebarSearch onOpen={() => {}} collapsed />
      </Stack>
    </Card>
  )
}

function MotionBlock() {
  const [on, setOn] = useState(false)
  return (
    <Card>
      <Group justify="space-between" align="center" mb="xs">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed">
          MOTION_* constants — a toggling element driven directly by the three shared constants
        </Text>
        <Switch label="Toggle" checked={on} onChange={(e) => setOn(e.currentTarget.checked)} />
      </Group>
      <Text size="sm" mb="xs">
        <code>MOTION_SPRING</code> drives the horizontal slide; <code>MOTION_DURATION.base</code> +{' '}
        <code>MOTION_EASE_STANDARD</code> drive the opacity tween — the same two mechanisms every
        animated basalt component (e.g. `ThemeToggle`) reaches for instead of inventing its own.
      </Text>
      <motion.div
        animate={{ x: on ? 160 : 0, opacity: on ? 1 : 0.4 }}
        transition={{
          x: MOTION_SPRING,
          opacity: { duration: MOTION_DURATION.base, ease: MOTION_EASE_STANDARD },
        }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--vx-radius-ctrl)',
          background: VX.accent,
        }}
      />
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
      <OverflowMenuBlock />
      <SidebarSearchBlock />
      <MotionBlock />
    </Stack>
  )
}
