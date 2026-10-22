/**
 * List-row recipe (SPEC § 6.9): leading glyph, title, one meta line, trailing affordance, inset
 * row-inset-y × row-inset-x at the control radius. A recipe, not an export (D4): built from Mantine.
 */
import { Text, UnstyledButton } from '@mantine/core'
import type { ReactNode } from 'react'
import classes from '../list-row.module.css'

export type ListRowProps = {
  glyph: ReactNode
  title: string
  /** One line under the title; ellipsized rather than wrapped. */
  meta: string
  /** The trailing affordance: a count, a chevron, a status. */
  trailing?: ReactNode
  onClick: () => void
}

export function ListRow({ glyph, title, meta, trailing, onClick }: ListRowProps) {
  return (
    <UnstyledButton className={classes.row} onClick={onClick}>
      {glyph}
      <div className={classes.text}>
        <Text size="sm" fw={500} truncate>
          {title}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {meta}
        </Text>
      </div>
      {trailing}
    </UnstyledButton>
  )
}
