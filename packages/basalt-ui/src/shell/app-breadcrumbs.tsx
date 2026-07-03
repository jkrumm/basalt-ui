/**
 * Slim top-bar breadcrumb: `Section / Page`. Section is muted (nav context), page is emphasized.
 *
 * Grounded verbatim in argo `apps/dashboard/src/components/app-shell/app-breadcrumbs.tsx`. This is
 * a real, presentational component (no app coupling) — not a stub.
 */
import { Anchor, Group, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export type BreadcrumbLinkRenderer = (href: string, label: string) => ReactNode

export function AppBreadcrumbs({
  section,
  parent,
  parentHref,
  renderBreadcrumbLink,
  page,
}: {
  section?: string
  /** Parent item label — shown when the active page is a nested child (e.g. "Dashboard"). */
  parent?: string | undefined
  /** Parent item href — when provided, the parent label renders as a clickable link. */
  parentHref?: string | undefined
  /**
   * Optional router link renderer for the parent breadcrumb segment. When provided, the parent
   * label is rendered through this callback instead of a plain `<a href>`, enabling client-side
   * navigation (e.g. TanStack `<Link>`).
   */
  renderBreadcrumbLink?: BreadcrumbLinkRenderer | undefined
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
      {parent && parentHref && (
        <>
          {renderBreadcrumbLink ? (
            renderBreadcrumbLink(parentHref, parent)
          ) : (
            <Anchor size="sm" c="dimmed" underline="never" href={parentHref} truncate>
              {parent}
            </Anchor>
          )}
          <Text size="sm" c="dimmed">
            /
          </Text>
        </>
      )}
      {parent && !parentHref && (
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
