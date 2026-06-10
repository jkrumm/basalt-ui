/**
 * Presentational app sidebar — a collapsible icon-rail with grouped nav sections, a brand header,
 * and a footer settings menu. Route coupling (active detection, collapse store) stays app-side and
 * is fed here as resolved `sections` + `collapsed`/`onToggleCollapse`/`onClose`.
 *
 * Grounded in argo `apps/dashboard/src/components/app-shell/app-sidebar.tsx`. S0 renders a section
 * skeleton with the stable prop surface; the full NavLink rail + theme menu lands in S3.
 */
import { Stack, Text } from '@mantine/core'
import type { SidebarSection } from './index'

export type AppSidebarProps = {
  sections: SidebarSection[]
  collapsed: boolean
  onToggleCollapse: () => void
  onClose: () => void
}

export function AppSidebar({ sections, collapsed }: AppSidebarProps) {
  return (
    <Stack gap="lg" data-collapsed={collapsed || undefined} style={{ flex: 1, minHeight: 0 }}>
      {sections.map((section) => (
        <Stack key={section.label} gap={2}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {section.label}
          </Text>
        </Stack>
      ))}
    </Stack>
  )
}
