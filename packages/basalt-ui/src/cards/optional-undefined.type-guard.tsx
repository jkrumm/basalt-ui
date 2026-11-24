/**
 * Compile-time proof, checked by `tsc --noEmit`: under `exactOptionalPropertyTypes` every optional
 * field of `StatCellProps`, `StatCardProps`, `FrameHead` and each `FootFacts` entry takes a
 * maybe-value straight, with no conditional spread, and `undefined` means the same as an absent key.
 */
import type { ReactElement } from 'react'
import type { CardMenu, Fact, FootFacts } from '../core/phase'
import type { BoxSlot, ControlsSlot, Delta, IconComponent, MeterSpec, Verdict } from '../core/ports'
import type { StatRow } from './contract'
import { BarList } from './bar-list'
import { StatCard } from './stat-card'
import { StatCell } from './stat-cell'

declare const text: string | undefined
declare const flag: boolean | undefined
declare const value: number | string | null | undefined
declare const delta: Delta | undefined
declare const status: Verdict | undefined
declare const swatch: { light: string; dark: string } | undefined
declare const meter: MeterSpec | undefined
declare const chart: BoxSlot | undefined
/** `StatCell` holds `rows` to at most four, so a maybe-value of two rows. */
declare const rows: readonly [StatRow, StatRow] | undefined
declare const axisLabels: readonly [string, string, string] | undefined
declare const footer: FootFacts | undefined
declare const controls: ControlsSlot<'widget'> | undefined
declare const menu: CardMenu | undefined
declare const icon: IconComponent | undefined
declare const fact: Fact | undefined

export const everyCellField: ReactElement = (
  <StatCell
    title="Too weak this week"
    swatch={swatch}
    subtitle={text}
    info={text}
    value={value}
    unit={text}
    delta={delta}
    status={status}
    sub={text}
    subMono={flag}
    srText={text}
    meter={meter}
    chart={chart}
    rows={rows}
  />
)

export const everyCardField: ReactElement = (
  <StatCard
    title="Shipped"
    subtitle={text}
    icon={icon}
    info={text}
    value={1}
    unit={text}
    delta={delta}
    status={status}
    sub={text}
    subMono={flag}
    chart={chart}
    axisLabels={axisLabels}
    footer={footer}
    controls={controls}
    menu={menu}
  />
)

/** A maybe-fact drops itself like `null`, in either position. */
export const maybeFacts: FootFacts = [fact, fact]
export const leadingUndefined: FootFacts = [undefined, { label: 'Merged', value: 4 }]

/** A `BarList` row's muted second figure takes a maybe-value straight (n90). */
export const maybeSecondary: ReactElement = (
  <BarList title="Top projects" items={[{ label: 'argo', value: 1, secondary: text }]} />
)

export const monoSub: ReactElement = (
  <StatCell title="Last drop" value={3} unit="min" sub="2026-11-16 03:12" subMono />
)

// @ts-expect-error a footer still holds at most two facts
export const noThirdFact: FootFacts = [fact, fact, fact]
