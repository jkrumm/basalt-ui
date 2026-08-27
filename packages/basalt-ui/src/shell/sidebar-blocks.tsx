/**
 * Sidebar blocks — the renderer for `SidebarBlock[]` (`docs/CONTROLS-SPEC.md` §2.3, law C13).
 *
 * A block is the "Awaiting action" / "Recents" / "Getting started 1 of 5" shape every consumer
 * hand-rolled into `sidebarNavExtra`: a micro-label, a short list of NON-destination rows, and
 * sometimes a fold. Because it arrives as DATA, basalt owns the two projections a `ReactNode` slot
 * could never express — the collapsed rail (a dot on the icon, a ring on the settings row) and the
 * mobile More sheet (`app-mobile-nav.tsx`).
 *
 * Styling deliberately lives in `app-sidebar.module.css`, not in a module of its own: the
 * collapsed-rail rules are `.root[data-collapsed] …` descendant selectors, and `.root` is that
 * module's class. A second CSS module would hash `.block*` into a different name than the rail
 * rules could ever select.
 */
import { Collapse, NavLink, Progress, Text, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type {
  SidebarBlockItem,
  SidebarBlockTone,
  SidebarCustomBlock,
  SidebarListBlock,
  SidebarProgressBlock,
} from '../nav/types'
import { NavCountBadge } from './nav-count-badge'
import { createPersistedState } from '../state'
import {
  FOLD_VERSION,
  sidebarBlockFoldKey,
  sidebarBlockRail,
  sidebarBlockVisibleCount,
} from './sidebar-block-model'
import classes from './app-sidebar.module.css'

/**
 * Fold/expand chevron. Lives here rather than in `app-sidebar.tsx` purely for direction: that
 * module imports this one, so a glyph shared by a collapsible SECTION header and a collapsible
 * BLOCK header has to sit on this side of the edge or the two files cycle.
 */
export function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {open ? <path d="M6 9l6 6l6 -6" /> : <path d="M9 6l6 6l-6 6" />}
    </svg>
  )
}

/**
 * One memoized `createPersistedState` store per fold key — the same module-scope factory pattern
 * (and the same reason for it) as `collapseStore` in `index.tsx`: `createPersistedState` is a
 * per-key FACTORY, so calling it during render would allocate a fresh store and a fresh
 * `useSyncExternalStore` subscription on every commit. The FIRST caller's `initial` wins, which is
 * what makes a `defaultCollapsed` a seed rather than a value that fights the persisted one.
 */
const foldStores = new Map<string, () => readonly [boolean, (next: boolean) => void]>()

function foldStore(
  key: string,
  initial: boolean,
): () => readonly [boolean, (next: boolean) => void] {
  const cached = foldStores.get(key)
  if (cached) return cached
  const store = createPersistedState<boolean>({ key, version: FOLD_VERSION, initial })
  foldStores.set(key, store)
  return store
}

/**
 * A persisted fold flag (`true` = folded). Exactly one hook call regardless of `key`, so swapping
 * keys mid-life never moves the hook count.
 *
 * Every fold in the sidebar goes through this — block folds at `basalt:sidebar-block:<key>` and
 * nav-section folds at `basalt:sidebar-section:<label-slug>`. Through 1.27.0 the section folds were
 * one `useState` keyed by label, so every reload re-opened a section the user had closed.
 */
export function usePersistedFold(
  key: string,
  initial: boolean,
): readonly [boolean, (next: boolean) => void] {
  return foldStore(key, initial)()
}

/**
 * Block micro-label. Reuses `.sectionLabel` — the SAME class a nav section header uses, so a block
 * heading and a section heading cannot drift apart (docs/DESIGN-SPEC.md §3).
 */
function BlockLabel({ children }: { children: ReactNode }) {
  return (
    <Text component="div" className={classes.sectionLabel}>
      {children}
    </Text>
  )
}

/** Status dot — the icon fallback for a toned row. Reads `--vx-status-*` through `data-tone`. */
export function SidebarBlockToneDot({ tone }: { tone: SidebarBlockTone }) {
  return <span className={classes.blockToneDot} data-tone={tone} aria-hidden />
}

/** `value` of `total` as a ring — the collapsed rail's stand-in for a progress block. */
export function SidebarProgressRing({ value, total }: { value: number; total: number }) {
  // r=8 in a 20x20 box: the circumference is a constant, so the arc is a dash offset rather than a
  // path computed per render.
  const CIRCUMFERENCE = 2 * Math.PI * 8
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0
  return (
    <span className={classes.blockRing} data-basalt-rail-ring>
      <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden>
        <circle cx={10} cy={10} r={8} fill="none" stroke="var(--vx-divider)" strokeWidth={2} />
        <circle
          cx={10}
          cy={10}
          r={8}
          fill="none"
          stroke="var(--vx-accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </span>
  )
}

/**
 * One list row. A row with no `Anchor`, `href` or `onClick` is NOT a link — the "Recents" shape is
 * plain text, and wrapping it in an `<a>` with nowhere to go is what makes a keyboard walk through
 * the sidebar land on dead stops.
 */
function BlockRow({ item }: { item: SidebarBlockItem }) {
  const lead =
    item.icon ?? (item.tone !== undefined ? <SidebarBlockToneDot tone={item.tone} /> : undefined)
  const meta =
    item.meta !== undefined ? (
      <Text component="span" className={classes.blockRowMeta}>
        {item.meta}
      </Text>
    ) : undefined

  const interactive =
    item.Anchor !== undefined || item.href !== undefined || item.onClick !== undefined
  if (!interactive) {
    return (
      <div className={`${classes.blockRow} ${classes.blockRowStatic}`}>
        {lead}
        <Text component="span" className={classes.blockRowLabel}>
          {item.label}
        </Text>
        {meta}
      </div>
    )
  }

  const shared = {
    classNames: { root: classes.blockRow },
    label: item.label,
    ...(lead !== undefined && { leftSection: lead }),
    ...(meta !== undefined && { rightSection: meta }),
    ...(item.onClick !== undefined && { onClick: item.onClick }),
  }
  const Anchor = item.Anchor
  if (Anchor) return <NavLink component={Anchor} {...shared} />
  return <NavLink component="a" {...(item.href !== undefined && { href: item.href })} {...shared} />
}

/**
 * A `kind: 'list'` block. Two independent states, deliberately: the FOLD is persisted (a user who
 * closes "Recents" keeps it closed across reloads) while "Show more" is ephemeral — it is a
 * momentary reach into a longer list, not a preference, and persisting it would quietly grow the
 * sidebar for good.
 */
function ListBlock({ block }: { block: SidebarListBlock }) {
  const [folded, setFolded] = usePersistedFold(sidebarBlockFoldKey(block.key), false)
  const [showAll, setShowAll] = useState(false)

  const rail = sidebarBlockRail(block)
  const visible = showAll
    ? block.items.length
    : sidebarBlockVisibleCount(block.items.length, block.max)
  const hidden = block.items.length - visible

  const label = (
    <>
      {block.icon !== undefined && (
        <span className={classes.blockIcon}>
          {block.icon}
          {rail === 'dot' && <span className={classes.blockDot} aria-hidden />}
        </span>
      )}
      <BlockLabel>{block.label}</BlockLabel>
      {block.count ? <NavCountBadge count={block.count} /> : null}
    </>
  )

  const body = (
    <div className={classes.blockItems}>
      {block.items.slice(0, visible).map((item) => (
        <BlockRow key={item.key} item={item} />
      ))}
      {hidden > 0 || showAll ? (
        <UnstyledButton
          className={classes.blockMore}
          onClick={() => setShowAll(!showAll)}
          aria-expanded={showAll}
        >
          {showAll ? 'Show less' : 'Show more'}
        </UnstyledButton>
      ) : null}
    </div>
  )

  return (
    <div className={classes.block} data-rail={rail}>
      {block.collapsible === true ? (
        <>
          <UnstyledButton
            className={`${classes.blockHeader} ${classes.blockHeaderButton}`}
            onClick={() => setFolded(!folded)}
            aria-expanded={!folded}
          >
            {label}
            <IconChevron open={!folded} />
          </UnstyledButton>
          <Collapse expanded={!folded}>{body}</Collapse>
        </>
      ) : (
        <>
          <div className={classes.blockHeader}>{label}</div>
          {body}
        </>
      )}
    </div>
  )
}

/** A `kind: 'progress'` block — the "Getting started 1 of 5" row pinned above the footer. */
function ProgressBlock({ block }: { block: SidebarProgressBlock }) {
  const percent =
    block.total > 0 ? Math.min(100, Math.max(0, (block.value / block.total) * 100)) : 0
  const inner = (
    <>
      <div className={classes.blockProgressHead}>
        <BlockLabel>{block.label}</BlockLabel>
        <Text component="span" className={classes.blockRowMeta}>
          {block.value} of {block.total}
        </Text>
      </div>
      <Progress value={percent} size="xs" aria-label={block.label} />
    </>
  )

  return (
    <div className={classes.block} data-rail={sidebarBlockRail(block)}>
      {block.onClick !== undefined ? (
        <UnstyledButton className={classes.blockProgress} onClick={block.onClick}>
          {inner}
        </UnstyledButton>
      ) : (
        <div className={classes.blockProgress}>{inner}</div>
      )}
    </div>
  )
}

/** A `kind: 'custom'` block — consumer content, hidden on the rail exactly as `navExtra` was. */
function CustomBlock({ block }: { block: SidebarCustomBlock }) {
  return (
    <div className={classes.block} data-rail="hidden">
      {block.node}
    </div>
  )
}

/** One block, whichever kind it is. `AppSidebar` places it; this decides nothing but the paint. */
export function SidebarBlockView({
  block,
}: {
  block: SidebarListBlock | SidebarProgressBlock | SidebarCustomBlock
}) {
  if (block.kind === 'list') return <ListBlock block={block} />
  if (block.kind === 'progress') return <ProgressBlock block={block} />
  return <CustomBlock block={block} />
}
