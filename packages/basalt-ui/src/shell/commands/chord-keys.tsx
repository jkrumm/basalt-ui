import { Fragment } from 'react'
import type { ReactElement } from 'react'
import { Kbd } from '../../ui/kbd'
import { chordKeys } from './chord'
import type { Chord } from './chord'

/** The keys of a chord or a sequence: one `Kbd` per key, `then` between the steps of a sequence. */
export function ChordKeys({ steps }: { steps: readonly Chord[] }): ReactElement {
  return (
    <span data-slot="chord-keys" className="flex shrink-0 items-center gap-1">
      {steps.map((step, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="text-xs text-faint">then</span>}
          {chordKeys(step).map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </Fragment>
      ))}
    </span>
  )
}
