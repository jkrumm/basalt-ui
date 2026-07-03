/**
 * Slim top-bar breadcrumb: `Section / Page`. Section is muted (nav context), page is emphasized.
 *
 * Grounded verbatim in argo `apps/dashboard/src/components/app-shell/app-breadcrumbs.tsx`. This is
 * a real, presentational component (no app coupling) — not a stub.
 */
import { Group, Text } from '@mantine/core'

export function AppBreadcrumbs({
  section,
  parent,
  page,
}: {
  section?: string
  /** Parent item label — shown when the active page is a nested child (e.g. "Dashboard"). */
  parent?: string | undefined
  page?: string
}) {
  if (!page) return null
  return (
    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
      {section && (
        <>
          <Text size="sm" c="dimmed" truncate>
            {section}
          </Text>
          <Text size="sm" c="dimmed">
            /
          </Text>
        </>
      )}
      {parent && (
        <>
          <Text size="sm" c="dimmed" truncate>
            {parent}
          </Text>
          <Text size="sm" c="dimmed">
            /
          </Text>
        </>
      )}
      <Text size="sm" fw={600} truncate>
        {page}
      </Text>
    </Group>
  )
}
