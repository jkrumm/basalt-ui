import { Facts, Peek } from 'basalt-ui/page'
import { usePeek } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { globals } from './globals'
import { recordOf } from './peek-records'

/** The record kinds a plain click opens in the peek: one, by its page. */
const KINDS = { record: '/peek/$id' } as const

/**
 * Mounted once inside the shell: a plain click on any link to `/peek/<id>` opens that record beside
 * the page it was clicked on. No screen wires it.
 */
export function PeekLayer(): ReactElement | null {
  const peek = usePeek({ field: globals.field.peek, kinds: KINDS })
  if (peek.open === null) return null
  const record = recordOf(peek.open.id)
  return (
    <Peek
      title={record?.title ?? `Record ${peek.open.id}`}
      tag={`#${peek.open.id}`}
      {...(peek.fullPage !== null && { fullPage: peek.fullPage })}
      onClose={peek.close}
    >
      {record === undefined ? (
        <p className="m-0 text-sm text-muted-foreground">No such record.</p>
      ) : (
        <Facts
          rows={[
            { label: 'State', value: record.state },
            { label: 'Owner', value: record.owner },
            { label: 'Note', value: record.note },
          ]}
        />
      )}
    </Peek>
  )
}
