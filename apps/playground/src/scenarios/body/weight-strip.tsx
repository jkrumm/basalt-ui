/**
 * A stat strip whose Weight cell holds nested shot anchors (argo UPSTREAM Wave 53 row 2): the goal
 * line `strip-footer-weight-goal` rides `under` the Weight cell, which shows its empty reason (a
 * cell in `state` draws no footer of its own), and `empty-row` joins it under `shotState === 'empty'`.
 */
import { Anchor, Box } from '@mantine/core'
import { DeltaBadge, EmptyState, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { noop } from '../shot-state'
import { BODY, BODY_PREV, CALIPER_GAP, CALIPER_NEXT, WEIGH_IN_GAP, WEIGHT_ERROR } from './body-data'
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
      // At rest the cell carries the reading the trend and the meters state; it is a state only in empty or error.
      ...(failed
        ? { state: { kind: 'error', error: new Error(WEIGHT_ERROR), onRetry: noop } }
        : shotState === 'empty'
          ? { state: { kind: 'empty', reason: WEIGH_IN_GAP } }
          : {
              value: String(BODY.weightKg),
              unit: 'kg',
              delta: (
                <DeltaBadge
                  value={BODY.weightKg - BODY_PREV.weightKg}
                  polarity="up-bad"
                  period="vs 5 Oct"
                  format={(v) => `${Math.abs(v).toFixed(1)} kg`}
                />
              ),
            }),
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
      // The caliper reading is what is missing in empty; the cells say so instead of keeping last month's figures.
      ...(shotState === 'empty' && { state: { kind: 'empty', reason: CALIPER_GAP } }),
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
      // The caliper reading is what is missing in empty; the cells say so instead of keeping last month's figures.
      ...(shotState === 'empty' && { state: { kind: 'empty', reason: CALIPER_GAP } }),
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
        <Box data-shot="empty-row">
          <EmptyState tier="section" title={CALIPER_GAP} description={CALIPER_NEXT} />
        </Box>
      )}
    </Box>
  )
}
