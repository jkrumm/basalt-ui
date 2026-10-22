/**
 * A stat strip whose Weight cell holds nested shot anchors (argo UPSTREAM Wave 53 row 2): the goal
 * line `strip-footer-weight-goal` rides `under` the Weight cell, which shows its empty reason (a
 * cell in `state` draws no footer of its own), and `empty-row` joins it under `shotState === 'empty'`.
 */
import { Anchor, Box, Paper } from '@mantine/core'
import { DeltaBadge, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { noop } from '../shot-state'
import { BODY, BODY_PREV, NO_CALIPER, NO_WEIGH_INS, WEIGHT_ERROR } from './body-data'
import type { ScenarioProps } from '../shot-state'

/** A real, inert control: the footer states the next step as something that can be pressed. */
const GOAL_LINK = (
  <Anchor component="button" type="button" fz={VX.text.sm} onClick={noop}>
    Set a goal weight
  </Anchor>
)

export function BodyWeightStrip({ shotState }: ScenarioProps) {
  const loading = shotState === 'loading'
  const failed = shotState === 'error'
  const cells: StatStripCell[] = [
    {
      key: 'weight',
      caption: 'Weight',
      loading,
      state: failed
        ? { kind: 'error', error: new Error(WEIGHT_ERROR), onRetry: noop }
        : { kind: 'empty', reason: NO_WEIGH_INS },
    },
    {
      key: 'body-fat',
      caption: 'Body fat',
      value: String(BODY.fatPct),
      unit: '%',
      delta: (
        <DeltaBadge
          value={BODY.fatPct - BODY_PREV.fatPct}
          polarity="up-bad"
          period="vs 5 Oct"
          format={(v) => `${Math.abs(v).toFixed(1)} pts`}
        />
      ),
      footer: `Measured ${BODY.measured}`,
      loading,
    },
    {
      key: 'lean-mass',
      caption: 'Lean mass',
      value: String(BODY.leanKg),
      unit: 'kg',
      delta: (
        <DeltaBadge
          value={BODY.leanKg - BODY_PREV.leanKg}
          polarity="up-good"
          period="vs 5 Oct"
          format={(v) => `${Math.abs(v).toFixed(1)} kg`}
        />
      ),
      footer: `Measured ${BODY.measured}`,
      loading,
    },
  ]
  return (
    <Box data-shot="weight-strip">
      <StatGroup
        variant="strip"
        label="Body composition at a glance"
        cols={3}
        cells={cells}
        footer={[{ key: 'weight-goal', under: 'weight', content: GOAL_LINK }]}
      />
      {shotState === 'empty' && (
        <Paper>
          <Box data-shot="empty-row">{NO_CALIPER}</Box>
        </Paper>
      )}
    </Box>
  )
}
