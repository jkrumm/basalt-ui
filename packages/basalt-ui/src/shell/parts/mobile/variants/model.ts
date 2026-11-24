/**
 * What the trial variants paint, projected from the same `projectMobileNav` the tab bar reads, so a
 * destination's row, badge and active state mean one thing in every form.
 *
 * The bar's slots are the nav's SECTIONS in declared order, at most `BAR_SECTIONS`: each with the
 * section's icon (else its first destination's), the summed badge of its items (a dot when only dots
 * are lit), and its rows. A section of one destination is that destination. Everything else, the
 * workspace, the favourites and the account included, is behind More, which reveals the rail.
 */
import type { IconComponent } from '../../../../core/ports'
import { rollupBadges } from '../../../core/badges'
import { projectMobileNav } from '../../../core/mobile-projection'
import type { PhoneGroup, PhoneProjectionInput, PhoneRow } from '../../../core/mobile-projection'
import type { CoreNavSection, NavBadge } from '../../../core/types'

/** Section slots before More: five in a 360 px bar. */
export const BAR_SECTIONS = 4

/**
 * Every group of the nav, as the projector builds it. An empty explicit `tabs` list puts the whole
 * nav behind its More slot, which is then every group; a nav of one destination comes back as that
 * link slot and is wrapped in its group here.
 */
export function navGroups(input: PhoneProjectionInput): readonly PhoneGroup[] {
  const nav = { ...input.nav, mobile: { ...input.nav.mobile, tabs: [], maxTabs: 1 } }
  // No extras (blocks, settings, account): they live in the rail behind More, not in a section.
  const slot = projectMobileNav({
    nav,
    state: input.state,
    ...(input.badges !== undefined && { badges: input.badges }),
  }).slots[0]
  if (slot === undefined) return []
  if (slot.kind === 'link') return [{ id: slot.id, rows: [slot.row] }]
  return slot.groups
}

function flatten(rows: readonly PhoneRow[], out: PhoneRow[] = []): PhoneRow[] {
  for (const row of rows) {
    out.push(row)
    flatten(row.children, out)
  }
  return out
}

export const groupBadge = (rows: readonly PhoneRow[]): NavBadge | null =>
  rollupBadges(flatten(rows).map((row) => row.badge))

export const groupActive = (rows: readonly PhoneRow[]): boolean =>
  flatten(rows).some((row) => row.active)

export type BarSection = {
  readonly id: string
  readonly label: string
  readonly icon: IconComponent | undefined
  readonly rows: readonly PhoneRow[]
  readonly active: boolean
  readonly badge: NavBadge | null
  /** The one destination of a one-item section: the slot navigates instead of opening a list. */
  readonly only: PhoneRow | undefined
}

export type BarModel = {
  readonly sections: readonly BarSection[]
  /** The badge and active state of what only the rail behind More reaches. */
  readonly more: { readonly badge: NavBadge | null; readonly active: boolean }
}

export function barModel(
  input: PhoneProjectionInput,
  sections: readonly CoreNavSection[],
  max = BAR_SECTIONS,
): BarModel {
  const picked: BarSection[] = []
  const rest: PhoneRow[] = []
  for (const group of navGroups(input)) {
    const section = sections.find((candidate) => candidate.id === group.id)
    if (picked.length >= max || section === undefined) {
      rest.push(...group.rows)
      continue
    }
    const all = flatten(group.rows)
    const mobile = section.mobile === false ? undefined : section.mobile
    picked.push({
      id: group.id,
      label: mobile?.label ?? section.label,
      icon: mobile?.icon ?? section.icon ?? all.find((row) => row.icon !== undefined)?.icon,
      rows: group.rows,
      active: groupActive(group.rows),
      badge: groupBadge(group.rows),
      only: all.length === 1 && all[0]?.disabled !== true ? all[0] : undefined,
    })
  }
  return { sections: picked, more: { badge: groupBadge(rest), active: groupActive(rest) } }
}
