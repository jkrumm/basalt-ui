/**
 * A stat strip whose Weight cell holds nested shot anchors (argo UPSTREAM Wave 53 row 2): the goal
 * line `strip-footer-weight-goal` rides `under` the Weight cell, which shows its empty reason (a
 * cell in `state` draws no footer of its own), and `empty-row` joins it under `shotState === 'empty'`.
 */
import { Box, Paper } from '@mantine/core'
import { StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { noop } from '../shot-state'
import type { ScenarioProps } from '../shot-state'

export function BodyWeightStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const failed = shotState === 'error'
  const cells: StatStripCell[] = [
    {
      key: 'weight',
      caption: 'Weight',
      loading,
      state: failed
        ? { kind: 'error', error: new Error('The weight source did not answer.'), onRetry: noop }
        : { kind: 'empty', reason: 'No weigh-in in this window.' },
    },
    { key: 'body-fat', caption: 'Body fat', value: '17.8', unit: '%', loading },
    { key: 'lean-mass', caption: 'Lean mass', value: '66.9', unit: 'kg', loading },
  ]
  return (
    <Box data-shot="weight-strip">
      <StatGroup
        variant="strip"
        label="Body composition at a glance"
        cols={3}
        cells={cells}
        footer={[{ key: 'weight-goal', under: 'weight', content: 'Set a goal weight' }]}
      />
      {shotState === 'empty' && (
        <Paper>
          <Box data-shot="empty-row">No caliper session in this window.</Box>
        </Paper>
      )}
    </Box>
  )
}
