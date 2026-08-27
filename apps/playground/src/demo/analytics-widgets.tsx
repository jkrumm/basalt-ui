/**
 * The two bespoke widgets the reference analytics page drops into shipped slots — kept out of
 * `DashboardPage.tsx` so that file reads as the page's SHAPE (one `PageBar`, four grids) rather than
 * as the internals of two small components.
 */
import { Badge, Box, Group, Stack, Text } from '@mantine/core'
import { LineSparkline, VX } from 'basalt-ui/charts'
import { useEffect, useState } from 'react'
import type { BreakdownRow } from './analytics-data'

/** One breakdown row: label · value · a tiny trend. A row list, not a table — four columns of text
 * would out-shout the number that matters.
 *
 * `data-numeric` is a GLOBAL rule in `basalt-ui/styles.css` — the attribute puts any element in the
 * mono face wherever it appears, which is why there is no hand-written `fontFamily` here and why
 * the same attribute reads identically on a segment label, a filter pill and this row. */
export function BreakdownList({ rows }: { rows: readonly BreakdownRow[] }) {
  return (
    <Stack gap={2}>
      {rows.map((row) => (
        <Group key={row.key} justify="space-between" wrap="nowrap" gap="sm" py={8}>
          <Text size="sm" c={VX.ink2}>
            {row.label}
          </Text>
          <Group gap="sm" wrap="nowrap">
            <Text data-numeric size="xs" fw={500}>
              {row.value}
            </Text>
            <Box w={72}>
              <LineSparkline
                data={row.history}
                width={72}
                height={20}
                color={VX.faint}
                ariaLabel={`${row.label} trend`}
              />
            </Box>
          </Group>
        </Group>
      ))}
    </Stack>
  )
}

/** The `kind: 'custom'` payload — a live reading, so it counts its own seconds and must be mounted
 * once. Deliberately trivial: what is being dogfooded is the SLOT, not the widget. */
export function LiveChip() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <Badge variant="light" color="green" leftSection="●">
      <span data-numeric>{seconds}s</span> live
    </Badge>
  )
}
