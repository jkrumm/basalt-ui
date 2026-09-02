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
import type { CSSProperties } from 'react'
import type { NavAnchor } from './nav-types'
import { VX } from '../tokens'
import type { BasaltProps } from '../common/props'
import classes from './app-header.module.css'

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

export type AppBreadcrumbsProps = BasaltProps & {
  section?: string
  /** Parent item label — shown when the active page is a nested child (e.g. "Dashboard"). */
  parent?: string | undefined
  /**
   * The parent destination's router anchor (`SidebarItem.Anchor`), so the crumb navigates
   * client-side. basalt still owns every pixel of the crumb — the anchor only hosts the label.
   */
  parentAnchor?: NavAnchor | undefined
  /** Parent item href — the no-router fallback; ignored when `parentAnchor` is present. */
  parentHref?: string | undefined
  page?: string
}

export function AppBreadcrumbs({
  section,
  parent,
  parentAnchor,
  parentHref,
  page,
  className,
  style,
}: AppBreadcrumbsProps) {
  if (!page) return null
  return (
    <Group
      gap={6}
      wrap="nowrap"
      {...(className !== undefined && { className })}
      style={{ minWidth: 0, ...style }}
    >
      {/*
        The ANCESTOR crumbs, in one box so CSS can drop them below `sm` — law C9's swap, owned by the
        component, no JS media query and no first-paint flash. On a phone the header row is the
        scarcest space in the app and the breadcrumb is its one elastic side, so `Overview / Dashboard`
        truncated to `O… / D…` — three crumbs' worth of separators and ellipses saying nothing. The
        PAGE is the crumb that names where you are; the ancestors are navigation context, and the
        sidebar (a tap away on the bottom bar) is where a phone reader looks for that.
      */}
      {(section !== undefined || parent !== undefined) && (
        <Group gap={6} wrap="nowrap" className={classes.crumbAncestors} style={{ minWidth: 0 }}>
          {section && (
            <>
              <Text style={crumbStyle} truncate>
                {section}
              </Text>
              <Text style={separatorStyle}>/</Text>
            </>
          )}
          {parent && parentAnchor && (
            <>
              <Anchor style={crumbStyle} underline="never" component={parentAnchor} truncate>
                {parent}
              </Anchor>
              <Text style={separatorStyle}>/</Text>
            </>
          )}
          {parent && !parentAnchor && parentHref && (
            <>
              <Anchor style={crumbStyle} underline="never" href={parentHref} truncate>
                {parent}
              </Anchor>
              <Text style={separatorStyle}>/</Text>
            </>
          )}
          {parent && !parentAnchor && !parentHref && (
            <>
              <Text style={crumbStyle} truncate>
                {parent}
              </Text>
              <Text style={separatorStyle}>/</Text>
            </>
          )}
        </Group>
      )}
      <Text style={currentStyle} truncate>
        {page}
      </Text>
    </Group>
  )
}
