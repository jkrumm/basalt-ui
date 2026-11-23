import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useFormat } from 'basalt-ui'
import { shotState } from 'basalt-ui/data'
import { Facts, Page, PageBar } from 'basalt-ui/page'
import { defineControls, field, navTarget } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { EntityChip } from 'basalt-ui/ui/entity'
import { Factory, Mail, NotebookPen, Phone, StickyNote, TriangleAlert, Users } from 'lucide-react'
import type { ReactElement } from 'react'
import { NOTE_TYPES, NOTE_TYPE_LABELS, TODAY, notesQuery } from '../../demo/ref-inventory'
import type { Note, NoteType } from '../../demo/ref-inventory'

const ICONS: Record<NoteType, typeof Phone> = {
  call: Phone,
  meeting: Users,
  quality: TriangleAlert,
  email: Mail,
  memo: StickyNote,
}

/** The tab, the search and the open note live in the address: a shared link opens the same note. */
const store = defineControls({
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
const supplierLink = (n: Note) =>
  navTarget(linkOptions({ to: '/ref/suppliers/$id', params: { id: n.supplierId } }))

/** One note as its record: what the peek, the window and the page all show. */
function NoteDetail({ note }: { note: Note }): ReactElement {
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
                href={supplierLink(note)}
                avatar={{ shape: 'object', icon: Factory }}
              />
            ),
          },
          { label: 'Part', value: note.part },
          { label: 'Author', value: note.author },
          { label: 'Updated', value: f.relative(Date.parse(note.updated), TODAY) },
        ]}
      />
      <p className="m-0 text-sm text-pretty">{note.body}</p>
    </div>
  )
}

/**
 * The reference list in the notes shape: a title with its type icon, a quiet preview, linked
 * records and no tick column; a row opens the note as a side panel, a window or the page, with
 * previous and next through the rows.
 */
function NotesRoute(): ReactElement {
  const values = store.useValues()
  const needle = values.search.trim().toLowerCase()
  const query = shotState(useQuery(notesQuery))
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
      c.link('supplier', { header: 'Supplier', href: supplierLink }),
      c.text('part', { header: 'Part' }),
      c.person('author', { header: 'Author' }),
      c.relativeTime('updated', { header: 'Updated' }),
    ],
    data: notes === undefined ? undefined : rows,
    phase: query,
    bodyRows: 24,
    getRowId: (n) => n.id,
    mode: { kind: 'client' },
    now: TODAY,
    empty: { cause: 'No note matches the search. Try a supplier or a part number.' },
    detail: (note) => <NoteDetail note={note} />,
    detailTitle: (note) => note.title,
    detailState: store.field.note,
  })
  return (
    <Page area="ref-notes" fill>
      <PageBar
        tabs={{
          state: store.field.type,
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
          state: store.field.search,
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

export const Route = createFileRoute('/ref/notes')({
  staticData: { title: 'Notes' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: NotesRoute,
})
