/**
 * RouterDemoPage — self-contained embedded TanStack Router demo.
 *
 * Mounts its own memory-history router internally — the playground shell is router-agnostic
 * and is NOT converted to TanStack Router globally. Proves useBasaltNav + useRouterBreadcrumbs
 * against real route matches and staticData titles.
 */
import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouter,
} from '@tanstack/react-router'
import { useBasaltNav, useRouterBreadcrumbs } from 'basalt-ui/router-tanstack'

// ── Route tree ────────────────────────────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  staticData: { title: 'Home' },
  component: RouterShell,
})

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overview',
  staticData: { title: 'Overview', navSection: 'Main' },
  component: OverviewPage,
})

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  staticData: { title: 'Reports', navSection: 'Main' },
  component: ReportsPage,
})

const reportDetailRoute = createRoute({
  getParentRoute: () => reportsRoute,
  path: '$id',
  staticData: { title: 'Report Detail', navSection: 'Main' },
  component: ReportDetailPage,
})

const routeTree = rootRoute.addChildren([
  overviewRoute,
  reportsRoute.addChildren([reportDetailRoute]),
])

// ── Page components ───────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview' },
  { href: '/reports', label: 'Reports' },
  { href: '/reports/42', label: 'Report #42' },
]

function DemoNav() {
  const { currentPath, isActive } = useBasaltNav()
  const router = useRouter()

  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="xs">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed">
          useBasaltNav
        </Text>
        <Text size="sm">
          currentPath: <strong>{currentPath}</strong>
        </Text>
        <Group gap="xs">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.href}
              size="xs"
              variant={isActive(item.href) ? 'filled' : 'light'}
              onClick={() => router.navigate({ to: item.href })}
            >
              {item.label}
            </Button>
          ))}
        </Group>
        <Text size="xs" c="dimmed">
          isActive('/reports') (prefix): <strong>{String(isActive('/reports'))}</strong> ·
          isActive('/reports', exact):{' '}
          <strong>{String(isActive('/reports', { exact: true }))}</strong>
        </Text>
      </Stack>
    </Paper>
  )
}

function DemoBreadcrumbs() {
  const crumbs = useRouterBreadcrumbs()

  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="xs">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed">
          useRouterBreadcrumbs
        </Text>
        <Group gap="xs">
          {crumbs.map((c, i) => (
            <Group key={c.href} gap={4}>
              {i > 0 && (
                <Text size="sm" c="dimmed">
                  /
                </Text>
              )}
              <Badge size="sm" variant="light">
                {c.title}
              </Badge>
              <Text size="xs" c="dimmed">
                {c.href}
              </Text>
            </Group>
          ))}
        </Group>
      </Stack>
    </Paper>
  )
}

function OverviewPage() {
  return (
    <Text size="sm" c="dimmed">
      Overview route content
    </Text>
  )
}

function ReportsPage() {
  return (
    <Text size="sm" c="dimmed">
      Reports list route content
    </Text>
  )
}

function ReportDetailPage() {
  return (
    <Text size="sm" c="dimmed">
      Report detail route content (nested under /reports)
    </Text>
  )
}

function RouterShell() {
  return (
    <Stack gap="md">
      <DemoNav />
      <DemoBreadcrumbs />
    </Stack>
  )
}

// ── Embedded router (module singleton — created once, the idiomatic pattern) ──────────────────────

const demoRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/reports/42'] }),
})

// ── Page ──────────────────────────────────────────────────────────────────────────────────────────

export function RouterDemoPage() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./router-tanstack adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          useBasaltNav (isActive, currentPath) + useRouterBreadcrumbs — embedded memory router, no
          browser URL
        </Text>
      </div>

      <RouterProvider router={demoRouter} />
    </Stack>
  )
}
