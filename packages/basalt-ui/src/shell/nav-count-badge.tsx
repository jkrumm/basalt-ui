/**
 * `NavCountBadge` — the sidebar/menu unread-count chip. Its own module rather than a member of the
 * shell barrel so `app-mobile-nav.tsx` and `app-sidebar.tsx` can render it without importing the
 * barrel that imports THEM (an ESM value cycle). `shell/index.tsx` re-exports it, so the published
 * surface is unchanged.
 */
import { Badge } from '@mantine/core'
import { VX } from '../tokens'

/**
 * Sidebar nav count badge (docs/DESIGN-SPEC.md §5): mono 10.5px, ink-8% bg, radius 5, height 16,
 * padding 0 5px, muted text; `marginLeft: auto` pins it to the row end on any render path.
 * `styles` (inline) rather than a token color prop, since none of Mantine's variant/color
 * combinations land on the ink-tint idiom. Returns `null` for a zero/empty count so the badge slot
 * stays clean ("ink earns its color", DESIGN.md).
 */
export function NavCountBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <Badge
      size="sm"
      styles={{
        root: {
          backgroundColor: 'color-mix(in srgb, var(--vx-ink) 8%, transparent)',
          color: 'var(--vx-muted)',
          fontFamily: 'var(--basalt-font-mono)',
          fontSize: VX.text.micro,
          fontWeight: 500,
          height: 16,
          padding: '0 5px',
          marginLeft: 'auto',
          borderRadius: 'var(--vx-radius-tight)',
        },
      }}
    >
      {count}
    </Badge>
  )
}
