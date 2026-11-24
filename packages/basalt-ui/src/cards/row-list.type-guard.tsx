/**
 * Compile-time proof of `RowList`'s typing, checked by `tsc --noEmit`. Every `@ts-expect-error` is
 * one "never"; the valid list at the top proves the guards fail for the stated reason.
 */
import type { ReactElement } from 'react'
import { RowList } from './row-list'

const items = [
  { label: 'issue_1', meta: 'building', detail: 'Lists', value: '3 d', href: '/issue_1' },
  { label: 'issue_2', status: { tone: 'good', label: 'Healthy' }, onClick: () => undefined },
  { label: 'issue_3', indent: 2 },
] as const

export const validRows: ReactElement = (
  <RowList title="Open Issues" items={items} lines={2} mono separator="hairline" bodyRows={6} />
)

export const rowsNoClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <RowList title="Open Issues" items={items} className="p-8" />
)

export const rowsNoStyle: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <RowList title="Open Issues" items={items} style={{ color: 'red' }} />
)

export const rowsNoColor: ReactElement = (
  // @ts-expect-error a list takes no color
  <RowList title="Open Issues" items={items} color="red" />
)

export const rowsSeparatorColor: ReactElement = (
  // @ts-expect-error the separator is none or hairline, never a color or a width
  <RowList title="Open Issues" items={items} separator="border-foreground" />
)

export const rowLinkAndButton: ReactElement = (
  <RowList
    title="Open Issues"
    items={[
      // @ts-expect-error a row is a link or a button, never both
      { label: 'a', href: '/a', onClick: () => undefined },
    ]}
  />
)

export const rowValueNode: ReactElement = (
  // @ts-expect-error a value is text, never a node
  <RowList title="Open Issues" items={[{ label: 'a', value: <b>3</b> }]} />
)

export const rowStatusTone: ReactElement = (
  // @ts-expect-error a status tone is the closed vocabulary
  <RowList title="Open Issues" items={[{ label: 'a', status: { tone: 'red', label: 'Bad' } }]} />
)

export const rowsNotACount: ReactElement = (
  // @ts-expect-error the body holds a count of rows, never a height
  <RowList title="Open Issues" items={items} bodyRows="h-56" />
)
