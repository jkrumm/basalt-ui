import { Dock, Facts, Peek } from 'basalt-ui/page'
import { usePeek } from 'basalt-ui/router'
import { CalendarDays, FileText, Image, Link, Package } from 'lucide-react'
import type { ReactElement } from 'react'
import { globals } from './globals'
import { PhotoDetail } from './kit-photo-detail'
import { partFacts } from './part-facts'
import { PHOTOS, photoOf } from './kit-photos'
import { PEEK_RECORDS, recordOf } from './peek-records'
import { PARTS, partOf } from './ref-inventory'
import { VISITS, visitOf } from './ref-schedule'
import { VisitFacts } from './ref-visit'

/** The record kinds a plain click opens in the peek, by their page: the Home records, the Kit's photos, the reference parts and the reference schedule's entries. */
const KINDS = {
  record: '/peek/$id',
  photo: '/kit/photos/$id',
  part: '/ref/part/$id',
  visit: '/ref/events/$id',
} as const

type Kind = keyof typeof KINDS

/** Each kind's records in their list order: the peek steps through them. */
const IDS: Record<Kind, readonly string[]> = {
  record: PEEK_RECORDS.map((record) => record.id),
  photo: PHOTOS.map((photo) => photo.id),
  part: PARTS.map((part) => part.id),
  visit: VISITS.map((visit) => visit.id),
}

const ICONS = { record: FileText, photo: Image, part: Package, visit: CalendarDays } as const

/** Copies the record's own page address. */
function copyLink(path: string | null): void {
  if (path !== null) void navigator.clipboard?.writeText(new URL(path, window.location.href).href)
}

/** What `usePeek` hands back for an open record; the router entry exports no name for it. */
type PeekTarget<K extends string> = { kind: K; id: string }

function titleOf({ kind, id }: PeekTarget<Kind>): string {
  if (kind === 'photo') return photoOf(id)?.title ?? `Photo ${id}`
  if (kind === 'part') return partOf(id)?.name ?? `Part ${id}`
  if (kind === 'visit') return visitOf(id)?.title ?? `Entry ${id}`
  return recordOf(id)?.title ?? `Record ${id}`
}

function Body({ kind, id }: PeekTarget<Kind>): ReactElement {
  if (kind === 'record') return <RecordFacts id={id} />
  if (kind === 'part') {
    const part = partOf(id)
    return part === undefined ? (
      <p className="m-0 text-sm text-muted-foreground">No such part.</p>
    ) : (
      <Facts rows={partFacts(part)} />
    )
  }
  if (kind === 'visit') {
    const visit = visitOf(id)
    return visit === undefined ? (
      <p className="m-0 text-sm text-muted-foreground">No such entry.</p>
    ) : (
      <VisitFacts visit={visit} />
    )
  }
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
 * Mounted once inside the shell: a plain click on any link to `/peek/<id>`, `/kit/photos/<id>`, `/ref/part/<id>` or `/ref/events/<id>` opens that record beside
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
          kind={peek.open.kind}
          icon={ICONS[peek.open.kind]}
          title={titleOf(peek.open)}
          tag={`#${peek.open.id}`}
          {...(peek.fullPage !== null && {
            fullPage: peek.fullPage,
            favourite: {
              id: `${peek.open.kind}-${peek.open.id}`,
              label: titleOf(peek.open),
              icon: ICONS[peek.open.kind],
              target: peek.fullPage,
            },
          })}
          records={{ ids: IDS[peek.open.kind], id: peek.open.id, onStep: peek.go }}
          actions={[
            { id: 'copy', label: 'Copy link', icon: Link, onClick: () => copyLink(peek.fullPage) },
          ]}
          onClose={peek.close}
          onPin={peek.pin}
        >
          <Body {...peek.open} />
        </Peek>
      )}
      {dock.open !== null && (
        <Dock
          icon={ICONS[dock.open.kind]}
          title={titleOf(dock.open)}
          tag={`#${dock.open.id}`}
          {...(dock.fullPage !== null && {
            fullPage: dock.fullPage,
            favourite: {
              id: `${dock.open.kind}-${dock.open.id}`,
              label: titleOf(dock.open),
              icon: ICONS[dock.open.kind],
              target: dock.fullPage,
            },
          })}
          onClose={dock.close}
        >
          <Body {...dock.open} />
        </Dock>
      )}
    </>
  )
}
