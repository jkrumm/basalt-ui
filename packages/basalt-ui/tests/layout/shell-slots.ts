/**
 * The shell's named slots, resolved per `LAYOUT_TARGET`.
 *
 * A shell layout test names an element by SLOT (`S('shell-header')`), never by a library class or a
 * `data-basalt-*` handle. Each slot carries two selectors: `v3` is always `[data-slot="<name>"]`,
 * `v2` is the exact selector the 2.x oracle (the `origin/v2` checkout) answers to, or `null` where
 * 2.x has no equivalent. `LAYOUT_TARGET=v2` grades the oracle with those; the default `v3` grades the
 * rewrite.
 *
 * This is the ONLY shell-test file that may spell a library class, a `data-basalt-*` handle or a
 * CSS-module class — when the 2.x oracle is retired, the `v2` column goes and nothing else changes.
 */
import { SPACE_STEP } from '../../src/tokens/palette'
import { moduleClass, slot } from './harness/slots'

export type LayoutTarget = 'v2' | 'v3'

function resolveTarget(): LayoutTarget {
  const value = process.env['LAYOUT_TARGET'] ?? 'v3'
  if (value === 'v2' || value === 'v3') return value
  throw new Error(`LAYOUT: LAYOUT_TARGET must be "v2" or "v3", got "${value}"`)
}

export const LAYOUT_TARGET: LayoutTarget = resolveTarget()

interface SlotEntry {
  /** The 2.x selector, or `null` when 2.x has no equivalent. */
  readonly v2: string | null
  readonly v3: string
}

const entry = (name: string, v2: string | null): SlotEntry => ({ v2, v3: slot(name) })

// 2.x building blocks, composed below. Not exported: only the slot table may name them.
const HEADER = '.mantine-AppShell-header'
const HEADER_ROW = `${HEADER} > ${moduleClass('bar')}`
const HEADER_ZONE = `${HEADER_ROW} > ${moduleClass('zone')}`
const NAVBAR = '.mantine-AppShell-navbar'
const NAV_VIEWPORT = `${NAVBAR} .mantine-ScrollArea-viewport`
const SHEET = '.mantine-Drawer-content'

export const SHELL_SLOTS = {
  // The concept's pinned set (docs/v3/concepts/shell-nav-router.md § 3.5).
  'shell-skip': entry('shell-skip', null),
  'shell-header': entry('shell-header', HEADER),
  'shell-titlebar': entry('shell-titlebar', null),
  'shell-lead': entry('shell-lead', `${HEADER_ROW} > ${moduleClass('lead')}`),
  'shell-trail': entry('shell-trail', `${HEADER_ROW} ${moduleClass('global')}`),
  // 2.x has no breadcrumb node: the breadcrumb is whatever the lead wrapper holds.
  'shell-breadcrumb': entry('shell-breadcrumb', `${HEADER_ROW} > ${moduleClass('lead')} > *`),
  'shell-rail': entry('shell-rail', NAVBAR),
  'shell-rail-footer': entry('shell-rail-footer', `${NAVBAR} ${moduleClass('footer')}`),
  'shell-rail-block': entry('shell-rail-block', null),
  'shell-main': entry('shell-main', '[data-basalt-scrollport]'),
  page: entry('page', null),
  'page-bar': entry('page-bar', '[data-basalt-page-bar="shell"]'),
  'shell-aside': entry('shell-aside', 'aside.mantine-AppShell-aside'),
  'shell-tab-bar': entry('shell-tab-bar', 'nav[aria-label="Primary"]'),

  // Provisional v3 names not pinned by concept 3.5: later Issues confirm them.
  'shell-kebab': entry('shell-kebab', null),
  'shell-center': entry('shell-center', null),
  'shell-header-row': entry('shell-header-row', HEADER_ROW),
  'shell-brand-zone': entry('shell-brand-zone', HEADER_ZONE),
  'shell-rail-toggle': entry('shell-rail-toggle', `${HEADER_ZONE} button[aria-label$=" sidebar"]`),
  'shell-page-bar-host': entry('shell-page-bar-host', `${HEADER_ROW} ${moduleClass('pageBar')}`),
  'shell-rail-viewport': entry('shell-rail-viewport', NAV_VIEWPORT),
  'shell-rail-row': entry('shell-rail-row', `${NAV_VIEWPORT} .mantine-NavLink-root`),
  'shell-rail-row-icon': entry('shell-rail-row-icon', '.mantine-NavLink-section'),
  'shell-rail-dot': entry('shell-rail-dot', '[data-basalt-rail-dot]'),
  'shell-band': entry('shell-band', `.mantine-AppShell-root > ${moduleClass('band')}`),
  'shell-footer': entry('shell-footer', '.mantine-AppShell-footer'),
  'shell-sheet': entry('shell-sheet', SHEET),
  // SCOPED to the sheet on purpose: the desktop rail is still mounted (hidden) below `sm`, and an
  // unscoped row query would silently measure its rows and go vacuous.
  'shell-sheet-rows': entry('shell-sheet-rows', `${SHEET} .mantine-NavLink-root`),
  'shell-sheet-body': entry('shell-sheet-body', `${SHEET} .mantine-ScrollArea-viewport`),
  'shell-sheet-track': entry('shell-sheet-track', `${SHEET} [data-orientation="vertical"]`),
  'shell-menu': entry('shell-menu', '.mantine-Menu-dropdown'),
  'page-aside': entry('page-aside', '[data-basalt-page-aside]'),
  'page-aside-header': entry('page-aside-header', '[data-basalt-page-aside-header]'),
  'page-aside-fold': entry('page-aside-fold', '[data-basalt-page-aside-header] button'),
  'page-bar-pills-button': entry(
    'page-bar-pills-button',
    '[data-basalt-page-bar-line="pills"] > button',
  ),
  'select-input': entry('select-input', '.mantine-Select-input'),
  'page-summary-facts': entry('page-summary-facts', '[data-page-summary-facts]'),
  'page-summary-fact': entry('page-summary-fact', '[data-page-summary-fact]'),
  'sync-age-compact': entry('sync-age-compact', '[data-sync-age="compact"]'),
  'sync-age-long': entry('sync-age-long', '[class*="age_"]:not([data-sync-age])'),
} as const satisfies Record<string, SlotEntry>

export type ShellSlot = keyof typeof SHELL_SLOTS

/** The selector for `name` under the active `LAYOUT_TARGET`; throws where 2.x has none. */
export function shellSelector(name: ShellSlot): string {
  const { v2, v3 } = SHELL_SLOTS[name]
  if (LAYOUT_TARGET === 'v3') return v3
  if (v2 === null) throw new Error(`LAYOUT: slot ${name} has no 2.x selector`)
  return v2
}

export const S = shellSelector

/**
 * The frame numbers that differ between the two targets (px). Everything else the shell suite pins
 * (row pitch, section seams, footer air, gutters 8/16/24) is the same number on both, read from
 * `SPACE`/`SPACE_STEP` by the test itself.
 *
 * - 2.x: header 44, navbar 256 / rail 48, brand inset 20 (`rowInsetX` twice).
 * - v3 (concept 3.5, `shell/parts/grid.tsx`): header 48, rail 240 / 64, brand inset 16 (the rail's
 *   6 px padding plus the row's 10 px inset, so the brand mark sits on the nav icon column).
 */
export const SHELL_GEOMETRY =
  LAYOUT_TARGET === 'v2'
    ? {
        headerHeight: SPACE_STEP.appShellHeaderHeight,
        railExpanded: SPACE_STEP.appShellNavbarWidth,
        railCollapsed: SPACE_STEP.appShellNavbarRailWidth,
        brandInsetExpanded: 20,
      }
    : { headerHeight: 48, railExpanded: 240, railCollapsed: 64, brandInsetExpanded: 16 }
