/**
 * MobileNavPillPage — the mobile bar's ACTIVE PILL, side by side with and without icons.
 *
 * Round 4 found two defects in the same rule (`app-mobile-nav.module.css`'s `.tabIcon`) and this
 * page is where both are looked at rather than reasoned about:
 *
 * 1. The pill's inset was `padding: 2px 12px`, untokenized — so at any non-zero density the bar
 *    and the glyph scaled and the pill's inset did not. Move the theme-lab's density slider and
 *    the two bars below must keep their proportions.
 * 2. The pill IS the icon span's background, and a consumer shipping no icon dependency is
 *    supported (image-share does exactly that). With nothing inside, the span collapsed to a
 *    24x4px dash. The second bar below is that configuration; its pill must match the first's.
 *
 * The bars are the real `MobileNav` over a real `projectMobileNav` model — the only thing this
 * page supplies is the nav shape. Each frame is height-free on purpose: outside `AppShell.Footer`
 * there is no `--app-shell-footer-height` to fill, so the bar sizes to its own content. That makes
 * the frames a little shorter than the shipped 56px slot and leaves the PILL — the subject —
 * exact. Geometry claims about this component are measured in `tests/layout`, not here.
 */
import { Paper, Stack, Text, Title } from '@mantine/core'
import type { ReactElement } from 'react'
import { MobileNav, projectMobileNav } from 'basalt-ui'
import type { SidebarSection } from 'basalt-ui'
import { IconActivity, IconChart, IconDashboard } from './icons'

type Slot = { key: string; label: string; icon: ReactElement }

const SLOTS: Slot[] = [
  { key: 'home', label: 'Home', icon: <IconDashboard /> },
  { key: 'activity', label: 'Activity', icon: <IconActivity /> },
  { key: 'charts', label: 'Charts', icon: <IconChart /> },
]

/** `withIcons: false` is the icon-less consumer — every other field is identical. */
const sections = (withIcons: boolean): SidebarSection[] => [
  {
    label: 'Main',
    items: SLOTS.map((slot) => ({
      key: slot.key,
      label: slot.label,
      href: `#${slot.key}`,
      mobile: 'tab' as const,
      active: slot.key === 'home',
      // `undefined`, not an omitted key: `SidebarItem.icon` is required and holds a `ReactNode`,
      // and `useNav` hands MobileNav exactly this for a definition that leaves `icon` out.
      icon: withIcons ? slot.icon : undefined,
    })),
  },
]

function Bar({ withIcons }: { withIcons: boolean }): ReactElement {
  return (
    <Paper withBorder>
      <MobileNav model={projectMobileNav(sections(withIcons), { config: { maxTabs: 4 } })} />
    </Paper>
  )
}

export function MobileNavPillPage(): ReactElement {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>Mobile nav — the active pill</Title>
        <Text c="dimmed">
          The same bar with and without an icon dependency. Both pills must be the same shape, and
          both must keep their proportions as the theme-lab density slider moves.
        </Text>
      </Stack>

      <Stack gap="xs">
        <Text fw={600}>With icons</Text>
        <Bar withIcons />
      </Stack>

      <Stack gap="xs">
        <Text fw={600}>Without icons — no icon dependency shipped</Text>
        <Bar withIcons={false} />
      </Stack>
    </Stack>
  )
}
