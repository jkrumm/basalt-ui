/**
 * Compile-time proof of the page core's guarantees, checked by `tsc --noEmit`. Every
 * `@ts-expect-error` is one "never": remove the line and the file stops compiling. The valid usage
 * above each group proves the guards fail for the stated reason and not because the props are wrong
 * everywhere. The second primary action is a runtime row: the frozen `PageBarProps` tuple cannot
 * express "at most one", so `PageBar` raises a dev assertion (`page-bar.test.tsx`).
 */
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { PageAction } from './contract'
import { PageAside } from './page-aside'
import { PageBar } from './page-bar'
import { Section } from './section'

const act = (id: string): PageAction => ({ id, label: id, onClick: () => {} })

export const validAside: ReactElement = <PageAside title="Run details" />

export const asideWithoutTitle: ReactElement = (
  // @ts-expect-error an aside names itself: `title` is the header and the aria-label
  <PageAside />
)

export const asideNumericTitle: ReactElement = (
  // @ts-expect-error `title` is a string
  <PageAside title={7} />
)

export const validFiveActions: ReactElement = (
  <PageBar actions={[act('a'), act('b'), act('c'), act('d'), act('e')]} />
)

export const sixActions: ReactElement = (
  // @ts-expect-error a bar holds at most five actions
  <PageBar actions={[act('a'), act('b'), act('c'), act('d'), act('e'), act('f')]} />
)

export const textAction: ReactElement = (
  <PageBar actions={[{ kind: 'text', id: 'range', text: 'Nov 3 to 9' }]} />
)

export const validSection: ReactElement = <Section title="Latency" />

export const sectionWithoutTitle: ReactElement = (
  // @ts-expect-error a section is named by its title
  <Section />
)

export const sectionWithClassName: ReactElement = (
  // @ts-expect-error a section takes no styling channel
  <Section title="Latency" className="p-4" />
)

describe('page core type guard', () => {
  test('compiles (the assertions are the @ts-expect-error lines)', () => {
    expect(true).toBe(true)
  })
})
