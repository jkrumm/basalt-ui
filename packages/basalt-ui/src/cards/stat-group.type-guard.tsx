/**
 * Compile-time proof of the group composites' typing, checked by `tsc --noEmit` (docs/v3/concepts/
 * charts-cards-kanban.md section 8). Every `@ts-expect-error` is one "never"; the valid group and
 * panel at the top prove the guards fail for the stated reason and not because the props are wrong
 * everywhere. Kept beside the composites it guards, like `bar-list.type-guard.tsx`.
 *
 * Limit: a JSX element is typed `JSX.Element` whatever component made it, so a `<div>` child of a
 * `StatGroup` type-checks. The guard catches what the type system can tell apart: text, a number and
 * an element that carries other props.
 */
import type { ReactElement } from 'react'
import { DataPanel } from './data-panel'
import { StatCell } from './stat-cell'
import { StatGroup } from './stat-group'

const row = { label: 'HRV', value: '64 ms' }

export const validGroup: ReactElement = (
  <StatGroup variant="strip" label="Recovery">
    <StatCell
      label="Recovery"
      qualifier="7 day"
      info="Readiness from sleep and load."
      value={82}
      unit="%"
      delta={{ value: '+4', polarity: 'up-good' }}
      status={{ tone: 'good', label: 'Optimal' }}
      sub="Updated 6:40"
      srText="Recovery 82 percent, optimal"
      meter={{ label: 'Recovery', value: 82, max: 100 }}
      chart={(box) => <svg height={box.height} />}
      rows={[row, row, row, row]}
      href="/recovery"
    />
    <StatCell label="Sleep" value={null} onSelect={() => undefined} />
  </StatGroup>
)

export const validCards: ReactElement = (
  <StatGroup variant="cards">
    <StatCell label="Downstream" value="412" unit="Mbit/s" phase="loading" />
  </StatGroup>
)

export const validPanel: ReactElement = (
  <DataPanel
    title="Open pull requests"
    skeleton={{ rows: 6 }}
    body={(box) => <svg height={box.height} />}
  />
)

export const validPanelHeight: ReactElement = (
  <DataPanel title="Board" skeleton={{ height: 240 }} body={() => null} />
)

export const cellClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <StatCell label="Recovery" className="p-8" />
)

export const cellStyle: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <StatCell label="Recovery" style={{ color: 'red' }} />
)

export const cellColor: ReactElement = (
  // @ts-expect-error a cell takes no colour
  <StatCell label="Recovery" color="red" />
)

export const cellTone: ReactElement = (
  // @ts-expect-error a cell takes no hue: a verdict is `status`
  <StatCell label="Recovery" tone="good" />
)

export const cellFifthRow: ReactElement = (
  // @ts-expect-error a cell holds at most four rows
  <StatCell label="Recovery" rows={[row, row, row, row, row]} />
)

export const cellLinkAndButton: ReactElement = (
  // @ts-expect-error a cell is a link or a button, never both
  <StatCell label="Recovery" href="/recovery" onSelect={() => undefined} />
)

export const cellStatusWithoutWord: ReactElement = (
  // @ts-expect-error a verdict carries a word, never a colour alone
  <StatCell label="Recovery" status={{ tone: 'good' }} />
)

export const panelClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <DataPanel title="Open" skeleton={{ rows: 3 }} body={() => null} className="p-8" />
)

export const panelColor: ReactElement = (
  // @ts-expect-error a panel takes no colour
  <DataPanel title="Open" skeleton={{ rows: 3 }} body={() => null} color="red" />
)

export const panelTone: ReactElement = (
  // @ts-expect-error a panel takes no hue
  <DataPanel title="Open" skeleton={{ rows: 3 }} body={() => null} tone="good" />
)

export const panelWithoutSkeleton: ReactElement = (
  // @ts-expect-error the loading panel draws its final shape, so `skeleton` is required
  <DataPanel title="Open" body={() => null} />
)

export const panelNodeBody: ReactElement = (
  // @ts-expect-error the body is a box slot, never a ready-made node
  <DataPanel title="Open" skeleton={{ rows: 3 }} body={<div />} />
)

export const groupClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <StatGroup variant="strip" className="gap-8">
    <StatCell label="Recovery" />
  </StatGroup>
)

export const groupWithoutVariant: ReactElement = (
  // @ts-expect-error the layout is named: `strip` or `cards`
  <StatGroup>
    <StatCell label="Recovery" />
  </StatGroup>
)

export const groupTextChild: ReactElement = (
  // @ts-expect-error a group takes cells, never text
  <StatGroup variant="strip">Recovery</StatGroup>
)

declare const notACell: ReactElement<{ title: string }>

export const groupForeignElement: ReactElement = (
  // @ts-expect-error a group takes cells: an element carrying other props is not one
  <StatGroup variant="strip">{notACell}</StatGroup>
)
