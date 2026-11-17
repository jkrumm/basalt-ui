import { Dock, Facts, Peek } from 'basalt-ui/page'
import { usePeek } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { globals } from './globals'
import { recordOf } from './peek-records'

/** The record kinds a plain click opens in the peek: one, by its page. */
const KINDS = { record: '/peek/$id' } as const

function RecordFacts({ id }: { id: string }): ReactElement {
  const record = recordOf(id)
  return record === undefined ? (
    <p className="m-0 text-sm text-muted-foreground">No such record.</p>
  ) : (
    <Facts
      rows={[
        { label: 'State', value: record.state },
        { label: 'Owner', value: record.owner },
        { label: 'Note', value: record.note },
      ]}
    />
  )
}

/**
 * Mounted once inside the shell: a plain click on any link to `/peek/<id>` opens that record beside
 * the page it was clicked on, and the peek's pin button docks it, so it stays while the reader
 * moves on and the page makes room for it. No screen wires either.
 */
export function PeekLayer(): ReactElement | null {
  const peek = usePeek({ field: globals.field.peek, dockField: globals.field.dock, kinds: KINDS })
  const { dock } = peek
  return (
    <>
      {peek.open !== null && (
        <Peek
          title={recordOf(peek.open.id)?.title ?? `Record ${peek.open.id}`}
          tag={`#${peek.open.id}`}
          {...(peek.fullPage !== null && { fullPage: peek.fullPage })}
          onClose={peek.close}
          onPin={peek.pin}
        >
          <RecordFacts id={peek.open.id} />
        </Peek>
      )}
      {dock.open !== null && (
        <Dock
          title={recordOf(dock.open.id)?.title ?? `Record ${dock.open.id}`}
          tag={`#${dock.open.id}`}
          {...(dock.fullPage !== null && { fullPage: dock.fullPage })}
          onClose={dock.close}
        >
          <RecordFacts id={dock.open.id} />
        </Dock>
      )}
    </>
  )
}
