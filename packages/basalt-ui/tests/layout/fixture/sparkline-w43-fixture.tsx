import type { ReactElement } from 'react'
import { Sparkline } from '../../../src/charts'
import { StatGroup } from '../../../src/index'

/** A lift's e1RM history that opens at its best: the line starts on the `PR` reference. */
const FROM_PR = [92, 90, 86, 88, 84, 80, 78, 76, 72, 70, 71, 69]
/** The same shape rising to its best: the line ends on the reference. */
const TO_PR = [60, 62, 61, 66, 70, 72, 75, 80, 84, 88, 90, 92]

/** Wave 43: argo's lift strip, a `PR` reference over a line that starts (or ends) on it. */
export function W43SparkFixture(): ReactElement {
  return (
    <div data-testid="w43-spark" style={{ width: 358 }}>
      <StatGroup
        variant="strip"
        label="Lifts"
        cols={2}
        cells={[
          {
            key: 'start',
            caption: 'Squat',
            value: '92',
            unit: 'kg',
            visual: (
              <Sparkline
                ariaLabel="Squat e1RM"
                data={FROM_PR}
                height={28}
                reference={92}
                referenceLabel="PR"
              />
            ),
          },
          {
            key: 'end',
            caption: 'Press',
            value: '92',
            unit: 'kg',
            visual: (
              <Sparkline
                ariaLabel="Press e1RM"
                data={TO_PR}
                height={28}
                reference={92}
                referenceLabel="PR"
              />
            ),
          },
        ]}
      />
    </div>
  )
}
