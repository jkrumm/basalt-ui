/**
 * Slim top-bar breadcrumb: `Section / Page`. Section is muted (nav context), page is emphasized.
 *
 * Grounded verbatim in argo `apps/dashboard/src/components/app-shell/app-breadcrumbs.tsx`. This is
 * a real, presentational component (no app coupling) — not a stub.
 *
 * Typography (docs/DESIGN-SPEC.md §5) is applied via the `style` prop rather than a CSS module:
 * the sizes come off the `VX.text` ladder, plus a `font-stretch` Mantine `Text` has no prop for.
 * Matches the existing house pattern for shell-local micro-typography (see `SectionLabel` in
 * `app-sidebar.tsx`) and sidesteps any CSS-module-vs-Mantine-stylesheet cascade-order ambiguity in
 * a consumer's bundler.
 */
import { Anchor, Group, Text } from '@mantine/core'
import type { CSSProperties, ReactNode } from 'react'
import { VX } from '../tokens'

export type BreadcrumbLinkRenderer = (href: string, label: string) => ReactNode

/** Parent/section crumbs — faint. */
const crumbStyle: CSSProperties = { fontSize: VX.text.md, color: 'var(--vx-faint)' }

/** `/` separators — in the "line" (strong border) color. */
const separatorStyle: CSSProperties = { fontSize: VX.text.md, color: 'var(--vx-surface-border)' }

/** The active page — head font at 88% stretch, weight 550, ink. */
const currentStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-head, var(--basalt-font-sans, ui-sans-serif, sans-serif))',
  fontStretch: '88%',
  fontSize: VX.text.lg,
  fontWeight: 550,
  color: 'var(--vx-ink)',
}

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
          <Text style={crumbStyle} truncate>
            {section}
          </Text>
          <Text style={separatorStyle}>/</Text>
        </>
      )}
      {parent && parentHref && (
        <>
          {renderBreadcrumbLink ? (
            renderBreadcrumbLink(parentHref, parent)
          ) : (
            <Anchor style={crumbStyle} underline="never" href={parentHref} truncate>
              {parent}
            </Anchor>
          )}
          <Text style={separatorStyle}>/</Text>
        </>
      )}
      {parent && !parentHref && (
        <>
          <Text style={crumbStyle} truncate>
            {parent}
          </Text>
          <Text style={separatorStyle}>/</Text>
        </>
      )}
      <Text style={currentStyle} truncate>
        {page}
      </Text>
    </Group>
  )
}
