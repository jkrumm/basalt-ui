import { useFormat } from 'basalt-ui'
import type { QueryStateLike } from 'basalt-ui/cards'
import { Facts, Page, PageBar } from 'basalt-ui/page'
import type { NavTarget } from 'basalt-ui'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { EntityChip } from 'basalt-ui/ui/entity'
import { Factory, Mail, NotebookPen, Phone, StickyNote, TriangleAlert, Users } from 'lucide-react'
import type { ReactElement } from 'react'
import { NOTE_TYPES, NOTE_TYPE_LABELS } from './model'
import type { Note, NoteType } from './model'

const ICONS: Record<NoteType, typeof Phone> = {
  call: Phone,
  meeting: Users,
  quality: TriangleAlert,
  email: Mail,
  memo: StickyNote,
}

/** The tab, the search and the open note live in the address: a shared link opens the same note. The route wires it. */
export const notesControls = defineControls({
  id: 'ref-notes',
  scope: 'page',
  fields: {
    type: field
      .enum(['all', ...NOTE_TYPES], 'all')
      .labels({ all: 'All notes', ...NOTE_TYPE_LABELS }),
    search: field.string(''),
    note: field.string(''),
  },
})

const c = col<Note>()

/** One note as its record: what the peek, the window and the page all show. */
function NoteDetail({
  note,
  now,
  supplierHref,
}: {
  note: Note
  now: number
  supplierHref: (supplierId: string) => NavTarget
}): ReactElement {
  const f = useFormat()
  return (
    <div data-shot="note" className="flex flex-col gap-4">
      <Facts
        rows={[
          { label: 'Type', value: NOTE_TYPE_LABELS[note.type] },
          {
            label: 'Supplier',
            value: (
              <EntityChip
                label={note.supplier}
                href={supplierHref(note.supplierId)}
                avatar={{ shape: 'object', icon: Factory }}
              />
            ),
          },
          { label: 'Part', value: note.part },
          { label: 'Author', value: note.author },
          { label: 'Updated', value: f.relative(Date.parse(note.updated), now) },
        ]}
      />
      <p className="m-0 text-sm text-pretty">{note.body}</p>
    </div>
  )
}

export type NotesListProps = {
  /** The notes query state: its rows and its phase. */
  notes: QueryStateLike & { data?: readonly Note[] | undefined }
  /** The reading time in ms, for the relative times. */
  now: number
  /** The link to a supplier's record. */
  supplierHref: (supplierId: string) => NavTarget
}

/**
 * The reference list in the notes shape: a title with its type icon, a quiet preview, linked
 * records and no tick column; a row opens the note as a side panel, a window or the page, with
 * previous and next through the rows.
 */
export function NotesList({ notes: query, now, supplierHref }: NotesListProps): ReactElement {
  const values = notesControls.useValues()
  const needle = values.search.trim().toLowerCase()
  const notes = query.data
  const matched = (notes ?? []).filter(
    (n) =>
      needle === '' ||
      n.title.toLowerCase().includes(needle) ||
      n.body.toLowerCase().includes(needle) ||
      n.supplier.toLowerCase().includes(needle),
  )
  const rows = values.type === 'all' ? matched : matched.filter((n) => n.type === values.type)
  const countOf = (type: NoteType): number => matched.filter((n) => n.type === type).length
  const t = useDataTable<Note>({
    id: 'ref-notes',
    label: 'Notes',
    columns: [
      c.title('title', { header: 'Note', type: (n) => n.type, icons: ICONS }),
      c.text('body', { header: 'Preview', quiet: true }),
      c.link('supplier', { header: 'Supplier', href: (n) => supplierHref(n.supplierId) }),
      c.text('part', { header: 'Part' }),
      c.person('author', { header: 'Author' }),
      c.relativeTime('updated', { header: 'Updated' }),
    ],
    data: notes === undefined ? undefined : rows,
    phase: query,
    bodyRows: 24,
    getRowId: (n) => n.id,
    mode: { kind: 'client' },
    now,
    empty: { cause: 'No note matches the search. Try a supplier or a part number.' },
    detail: (note) => <NoteDetail note={note} now={now} supplierHref={supplierHref} />,
    detailTitle: (note) => note.title,
    detailState: notesControls.field.note,
  })
  return (
    <Page area="ref-notes" fill>
      <PageBar
        tabs={{
          state: notesControls.field.type,
          label: 'Note types',
          badges:
            notes === undefined
              ? {}
              : {
                  all: { count: matched.length },
                  call: { count: countOf('call') },
                  meeting: { count: countOf('meeting') },
                  quality: { count: countOf('quality'), attention: countOf('quality') > 0 },
                  email: { count: countOf('email') },
                  memo: { count: countOf('memo') },
                },
        }}
        search={{
          state: notesControls.field.search,
          label: 'Search notes',
          placeholder: 'Title, text or supplier',
        }}
        actions={[
          {
            id: 'new',
            label: 'New note',
            icon: NotebookPen,
            primary: true,
            onClick: () => undefined,
          },
        ]}
      />
      <div data-shot="notes" className="flex min-h-0 flex-1 flex-col">
        <DataTable table={t} />
      </div>
    </Page>
  )
}
