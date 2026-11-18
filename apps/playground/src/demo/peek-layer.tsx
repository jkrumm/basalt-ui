import { Dock, Facts, Peek } from 'basalt-ui/page'
import { usePeek } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { globals } from './globals'
import { PhotoDetail } from './kit-photo-detail'
import { photoOf } from './kit-photos'
import { recordOf } from './peek-records'

/** The record kinds a plain click opens in the peek, by their page: the Home records and the Kit's photos. */
const KINDS = { record: '/peek/$id', photo: '/kit/photos/$id' } as const

type Kind = keyof typeof KINDS

/** What `usePeek` hands back for an open record; the router entry exports no name for it. */
type PeekTarget<K extends string> = { kind: K; id: string }

function titleOf({ kind, id }: PeekTarget<Kind>): string {
  if (kind === 'photo') return photoOf(id)?.title ?? `Photo ${id}`
  return recordOf(id)?.title ?? `Record ${id}`
}

function Body({ kind, id }: PeekTarget<Kind>): ReactElement {
  if (kind === 'record') return <RecordFacts id={id} />
  const photo = photoOf(id)
  return photo === undefined ? (
    <p className="m-0 text-sm text-muted-foreground">No such photo.</p>
  ) : (
    <PhotoDetail photo={photo} />
  )
}

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
 * Mounted once inside the shell: a plain click on any link to `/peek/<id>` or `/kit/photos/<id>` opens that record beside
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
          title={titleOf(peek.open)}
          tag={`#${peek.open.id}`}
          {...(peek.fullPage !== null && { fullPage: peek.fullPage })}
          onClose={peek.close}
          onPin={peek.pin}
        >
          <Body {...peek.open} />
        </Peek>
      )}
      {dock.open !== null && (
        <Dock
          title={titleOf(dock.open)}
          tag={`#${dock.open.id}`}
          {...(dock.fullPage !== null && { fullPage: dock.fullPage })}
          onClose={dock.close}
        >
          <Body {...dock.open} />
        </Dock>
      )}
    </>
  )
}
