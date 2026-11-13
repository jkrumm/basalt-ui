/**
 * c06 — the context window of a coding agent.
 *
 *   Question: How full is it, what fills it, and when should I compact?
 *   Decision: Compact now, or keep working until the warning line.
 *
 * One tall segmented bar of four parts against the 200K limit, a rule at the warning threshold and
 * a status strip under the part of the fill past it, in a `ChartCard`. Pointing at or focusing a
 * part swaps the card's headline to that part's tokens and share; leaving restores the total.
 */
import { Button, Stack } from '@mantine/core'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { StatusVerdict } from 'basalt-ui'
import { ChartCard } from 'basalt-ui/charts'
import type { ChartFact } from 'basalt-ui/charts'
import { compact, percent } from 'basalt-ui/format'
import { VX } from 'basalt-ui/tokens'
import { cardStateProps, noop, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import { ContextBar } from './ContextBar'
import { CATEGORIES, LARGEST, LIMIT_TOKENS, USED_TOKENS, WARN_SHARE, WARN_TOKENS } from './data'

const fig = (n: number): string => compact(n, { digits: 1 })

const SOURCE = 'agent session'
const EMPTY_COPY = 'No tokens counted yet. Start a session to begin counting.'

const PAST = USED_TOKENS - WARN_TOKENS

/** The rest headline: the total and a status pill, so the verdict is a word as well as a hue. */
const TOTAL_FACT: ChartFact = {
  value: fig(USED_TOKENS),
  unit: `of ${fig(LIMIT_TOKENS)} tokens`,
  comparison:
    PAST > 0 ? (
      <StatusVerdict color={VX.status.warn} word="Past the line" phrase={`by ${fig(PAST)}`} />
    ) : (
      <StatusVerdict color={VX.faint} word="Under the line" phrase={`${fig(-PAST)} to go`} />
    ),
}

export function ExprC06Scenario({ shotState }: ScenarioProps): ReactElement {
  const [activeKey, setActiveKey] = useState<string | undefined>(undefined)
  const active = CATEGORIES.find((c) => c.key === activeKey)
  const facts: ChartFact =
    active === undefined
      ? TOTAL_FACT
      : {
          value: fig(active.tokens),
          unit: `tokens in ${active.label.toLowerCase()}`,
          comparison: `${percent(active.tokens / LIMIT_TOKENS)} of the window`,
        }

  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <div data-shot="context-window" data-shot-hover>
        <ChartCard
          title="Context window"
          facts={facts}
          subtitle={`${percent(USED_TOKENS / LIMIT_TOKENS)} full. ${LARGEST.label} holds ${percent(LARGEST.tokens / USED_TOKENS)} of what is loaded.`}
          info={`Tokens loaded into the agent's window by category, against its ${fig(LIMIT_TOKENS)} limit. The agent should compact at ${percent(WARN_SHARE)}, ${fig(WARN_TOKENS)} tokens.`}
          actions={
            <Button size="xs" onClick={noop} disabled={shotState !== undefined}>
              Compact now
            </Button>
          }
          {...cardStateProps(shotState, retryCopy(SOURCE), 'content', EMPTY_COPY)}
        >
          <ContextBar
            categories={CATEGORIES}
            limit={LIMIT_TOKENS}
            warnAt={WARN_TOKENS}
            warnLabel={`Compact at ${percent(WARN_SHARE)}`}
            label={`Context window, ${fig(USED_TOKENS)} of ${fig(LIMIT_TOKENS)} tokens used, compact at ${fig(WARN_TOKENS)}`}
            activeKey={activeKey}
            onActive={setActiveKey}
            loading={shotState === 'loading'}
          />
        </ChartCard>
      </div>
    </Stack>
  )
}
