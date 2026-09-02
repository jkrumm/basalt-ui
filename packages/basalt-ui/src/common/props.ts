/**
 * The prop vocabulary every basalt component shares (Blueprint audit §1, isomorphic finding C8).
 *
 * The finding this file answers: 98 of 123 exported components drop `className`, so a consumer who
 * needs one margin has to fork the component. Fixing that per component is 79 edits; fixing it once
 * here is one — every component's props type extends `BasaltProps`, and the root element takes
 * `cx(classes.root, className)` plus `style`.
 *
 * **`className` + per-slot `classNames`, and nothing else.** No `styles` object, no `vars`: basalt
 * does not spread `...rest` onto the DOM (which is why the harness saw zero unknown-attribute
 * warnings), and a `styles`/`vars` surface would re-open the styling seam Mantine already owns for
 * the primitives underneath. A composite that needs more than its root styled declares its SLOT
 * NAMES in its own props type — `SlotStylesProps<'root' | 'header' | 'body'>` — so the slot set is
 * a documented, compiler-checked union rather than an open record.
 *
 * This module is **Mantine-free and React-type-only** so `./charts` and `./tokens` may reach it
 * without breaching the layer boundary (`common/boundary.test.ts` pins that, and `.oxlintrc.json`
 * bans `@mantine/*` here the same way it does for `state`/`query`/`guard`).
 */
import type { CSSProperties } from 'react'

/**
 * The base every basalt component accepts. `| undefined` is explicit on both members because
 * `exactOptionalPropertyTypes` is on: a component destructuring `className` and forwarding it to a
 * child would otherwise fail to type-check at every call site.
 */
export interface BasaltProps {
  /** Appended to the root element's own class — never replaces it. */
  readonly className?: string | undefined
  /** Merged onto the root element's own inline style, if it has one. */
  readonly style?: CSSProperties | undefined
}

/** One class per named slot. The slot union is the component's documented contract. */
export type SlotClassNames<S extends string> = Partial<Record<S, string>>

/**
 * The composite half of the contract: a container that paints more than one box publishes its slot
 * names here. The set is small on purpose — `Section`, `StatCard`, `ChartCard`, `PageBar`,
 * `PageAside`, `WidgetHeader`, `EmptyState`, `QueryState`, `BasaltDataTable`. A leaf takes
 * `BasaltProps` alone.
 */
export interface SlotStylesProps<S extends string> {
  readonly classNames?: SlotClassNames<S> | undefined
}

/**
 * The ONE status vocabulary (audit A13). Five forks exist today — `StatCardTone` and
 * `SidebarBlockTone` are byte-identical to this, `CalloutKind` / `AccountBadgeTone` /
 * `NotificationIntent` each differ — and they stay put for now: an adopter aliases its fork to this
 * type, it does not get renamed out from under a consumer.
 */
export type Tone = 'good' | 'warn' | 'bad'

/** `Tone` plus the un-toned state — a badge or a block with nothing to say yet. */
export type ToneWithNeutral = Tone | 'neutral'

/**
 * The heading tier (`docs/CONTROLS-SPEC.md` §2.2). Re-exported from its owner rather than declared
 * twice — `WidgetHeaderTier` stays the name on the public barrel; `Tier` is what `common`-aware
 * code spells. Type-only, so this file emits no runtime edge into the Mantine-coupled half.
 */
export type { WidgetHeaderTier as Tier } from '../dashboard/widget-header'

/**
 * The class joiner. Replaces the `[a, b].filter(Boolean).join(' ')` spelled out in seven files
 * today; falsy parts drop, so `cx(classes.root, open && classes.open, className)` is the idiom.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(' ')
}
