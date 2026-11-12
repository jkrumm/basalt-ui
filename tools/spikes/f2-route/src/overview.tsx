import { useQuery } from '@tanstack/react-query'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { strengthQueries } from './queries'
import { EXERCISE_LABEL } from './synthetic'
import type { StrengthParams } from './synthetic'

/** argo's lift strip: one cell per lift, current e1RM, 28 d delta, the e1RM trend in the chart slot. */
export function Overview({ params }: { params: StrengthParams }): ReactElement {
  const heroes = useQuery(strengthQueries.heroes(params))
  const sparks = useQuery(strengthQueries.sparklines(params))
  return (
    <StatGroup variant="strip" label="Lifts">
      {(heroes.data ?? [undefined, undefined, undefined, undefined]).map((h, i) => {
        const spark = sparks.data?.find((s) => s.exercise_id === h?.exercise_id)
        return (
          <StatCell
            key={h?.exercise_id ?? i}
            label={h === undefined ? 'Lift' : EXERCISE_LABEL[h.exercise_id]}
            qualifier="e1RM"
            phase={heroes}
            value={h?.e1rm ?? null}
            unit="kg"
            {...(h === undefined
              ? {}
              : {
                  delta: {
                    value: `${h.deltaPct > 0 ? '+' : ''}${h.deltaPct.toFixed(1)}%`,
                    polarity: 'up-good' as const,
                    label: '28 d',
                  },
                  sub: `${h.sessions} sessions`,
                })}
            {...(spark === undefined
              ? {}
              : {
                  chart: (box) => (
                    <Sparkline
                      series={spark.e1rm}
                      ariaLabel={`${EXERCISE_LABEL[spark.exercise_id]} e1RM trend`}
                      height={box.height}
                    />
                  ),
                })}
          />
        )
      })}
    </StatGroup>
  )
}
