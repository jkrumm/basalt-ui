/**
 * Compile-time proof of the cards contract, checked by `tsc --noEmit` (docs/v3/concepts/
 * charts-cards-kanban.md section 8). Every `@ts-expect-error` is one "never": remove the line and
 * the file stops compiling. The valid card at the top proves the guards fail for the stated reason
 * and not because the props are wrong everywhere.
 */
import type { ReactElement } from 'react'
import { StatCard } from './stat-card'

export const valid: ReactElement = (
  <StatCard
    title="Shipped"
    value={388}
    delta={{ value: '+12%', polarity: 'up-good' }}
    status={{ tone: 'good', label: 'On track' }}
    footer={[
      { label: 'Open', value: 12 },
      { label: 'Merged', value: 4 },
    ]}
    href="/flow"
  />
)

export const conditionalFact: ReactElement = (
  <StatCard title="Shipped" value={1} footer={[null, { label: 'Merged', value: 4 }]} />
)

export const noTone: ReactElement = (
  // @ts-expect-error a card takes no hue: a verdict is `status`
  <StatCard title="Shipped" value={1} tone="good" />
)

export const noColor: ReactElement = (
  // @ts-expect-error a card takes no colour
  <StatCard title="Shipped" value={1} color="red" />
)

export const noClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <StatCard title="Shipped" value={1} className="p-8" />
)

export const noStyle: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <StatCard title="Shipped" value={1} style={{ color: 'red' }} />
)

const a = { label: 'A', value: 1 }

export const thirdFact: ReactElement = (
  // @ts-expect-error the footer holds at most two facts
  <StatCard title="Shipped" value={1} footer={[a, a, a]} />
)

export const factNode: ReactElement = (
  // @ts-expect-error a fact value is data, never a node
  <StatCard title="Shipped" value={1} footer={[{ label: 'A', value: <b>1</b> }]} />
)

export const missingPolarity: ReactElement = (
  // @ts-expect-error a delta without a polarity cannot say whether it is good
  <StatCard title="Shipped" value={1} delta={{ value: '+12%' }} />
)

export const statusWithoutWord: ReactElement = (
  // @ts-expect-error a verdict carries a word, never a colour alone
  <StatCard title="Shipped" value={1} status={{ tone: 'good' }} />
)

export const linkAndButton: ReactElement = (
  // @ts-expect-error a card is a link or a button, never both
  <StatCard title="Shipped" value={1} href="/flow" onSelect={() => undefined} />
)

export const oneItemMenu: ReactElement = (
  // @ts-expect-error a menu has at least two actions; one is a plain button
  <StatCard title="Shipped" value={1} menu={[{ label: 'Open', href: '/flow' }]} />
)
