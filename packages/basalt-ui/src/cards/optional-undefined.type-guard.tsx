/**
 * Compile-time proof, checked by `tsc --noEmit`: under `exactOptionalPropertyTypes` every optional
 * field of `StatCellProps`, `StatCardProps`, `FrameHead` and each `FootFacts` entry takes a
 * maybe-value straight, with no conditional spread, and `undefined` means the same as an absent key.
 */
import type { ReactElement } from 'react'
import type { CardMenu, Fact, FootFacts } from '../core/phase'
import type { BoxSlot, ControlsSlot, Delta, IconComponent, MeterSpec, Verdict } from '../core/ports'
import type { StatRow } from './contract'
import { StatCard } from './stat-card'
import { StatCell } from './stat-cell'

declare const text: string | undefined
declare const value: number | string | null | undefined
declare const delta: Delta | undefined
declare const status: Verdict | undefined
declare const swatch: { light: string; dark: string } | undefined
declare const meter: MeterSpec | undefined
declare const chart: BoxSlot | undefined
/** `StatCell` holds `rows` to at most four, so a maybe-value of two rows. */
declare const rows: readonly [StatRow, StatRow] | undefined
declare const xLabels: readonly [string, string, string] | undefined
declare const footer: FootFacts | undefined
declare const controls: ControlsSlot<'widget'> | undefined
declare const menu: CardMenu | undefined
declare const icon: IconComponent | undefined
declare const fact: Fact | undefined

export const everyCellField: ReactElement = (
  <StatCell
    label="Too weak this week"
    swatch={swatch}
    qualifier={text}
    info={text}
    value={value}
    unit={text}
    delta={delta}
    status={status}
    sub={text}
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
    chart={chart}
    xLabels={xLabels}
    footer={footer}
    controls={controls}
    menu={menu}
  />
)

/** A maybe-fact drops itself like `null`, in either position. */
export const maybeFacts: FootFacts = [fact, fact]
export const leadingUndefined: FootFacts = [undefined, { label: 'Merged', value: 4 }]

// @ts-expect-error a footer still holds at most two facts
export const noThirdFact: FootFacts = [fact, fact, fact]
