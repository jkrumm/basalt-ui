import { Box } from '@mantine/core'
import type { ReactNode } from 'react'

/** Short-column tables never fill a 1440 card: the table ends where its rows do. One cap for every scenario table. */
const TABLE_MAX_WIDTH = 720

export function TableCap({ children }: { children: ReactNode }) {
  return <Box maw={TABLE_MAX_WIDTH}>{children}</Box>
}
