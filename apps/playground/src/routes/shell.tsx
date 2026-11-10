import { List, Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { PageAside, Section } from 'basalt-ui'

/**
 * The shell demo: the navigation, its mobile projection and the aside region. The page body
 * explains what to look at; the real subjects are the sidebar, the bottom bar and `PageAside`.
 */
function ShellRoute() {
  return (
    <Stack gap="lg">
      <Section
        title="Navigation"
        subtitle="One typed definition (demo/nav-model.tsx) feeds the sidebar, the bottom bar and the breadcrumb."
      >
        <List size="sm" spacing="xs">
          <List.Item>Four destinations are `mobile: 'tab'`; the rest fold into More.</List.Item>
          <List.Item>The Cards entry carries a count badge: a dot on the phone slot.</List.Item>
          <List.Item>The Scenarios group is built from the scenario registry.</List.Item>
        </List>
      </Section>
      <Section
        title="Sidebar blocks and global actions"
        subtitle="Declared once, projected onto the sidebar, the rail and the mobile More sheet."
      >
        <Text size="sm">
          The Awaiting action list collapses to a count and opens as one nested More-sheet row. The
          notification bell stays in the header bar; the theme toggle folds into the kebab menu.
        </Text>
      </Section>
      <PageAside title="Display" persistKey="shell">
        <Section
          title="Aside"
          info="From sm up this is the right-hand region; below sm it projects into the page."
        >
          <Text size="sm" c="dimmed">
            The aside is a fourth shell region, not a control home.
          </Text>
        </Section>
      </PageAside>
    </Stack>
  )
}

export const Route = createFileRoute('/shell')({
  staticData: { title: 'Shell' },
  component: ShellRoute,
})
