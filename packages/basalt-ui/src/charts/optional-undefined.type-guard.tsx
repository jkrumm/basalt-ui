/**
 * Compile-time proof, checked by `tsc --noEmit`: under `exactOptionalPropertyTypes` every optional
 * field of `ChartFigure` and `ChartCardProps` takes a maybe-value straight, with no conditional
 * spread, and `undefined` means the same as an absent key.
 */
import type { ReactElement } from 'react'
import type { CardMenu, FootFacts } from '../core/phase'
import type { ControlsSlot, Delta, IconComponent, Phase, Verdict } from '../core/ports'
import type { ChartFigure, LegendEntry } from './contract'
import { ChartCard } from './parts/chart-card'

declare const text: string | undefined
declare const delta: Delta | undefined
declare const status: Verdict | undefined
declare const phase: Phase | undefined
declare const legend: readonly LegendEntry[] | undefined
declare const footer: FootFacts | undefined
declare const controls: ControlsSlot<'widget'> | undefined
declare const menu: CardMenu | undefined
declare const height: 'auto' | 'short' | 'fill' | undefined
declare const icon: IconComponent | undefined
declare const figure: ChartFigure | undefined

export const everyFigureField: ChartFigure = {
  value: 42,
  unit: text,
  delta,
  period: text,
  status,
}

export const everyCardField: ReactElement = (
  <ChartCard
    title="Signal"
    subtitle={text}
    icon={icon}
    info={text}
    phase={phase}
    figure={figure}
    legend={legend}
    footer={footer}
    controls={controls}
    menu={menu}
    height={height}
    chart={() => null}
  />
)

export const explicitUndefined: ReactElement = (
  <ChartCard
    title="Signal"
    figure={{
      value: null,
      unit: undefined,
      delta: undefined,
      period: undefined,
      status: undefined,
    }}
    chart={() => null}
  />
)

// @ts-expect-error `value` stays required: an absent figure value is `null`, never a missing key
export const valueRequired: ChartFigure = { unit: 'ms' }
