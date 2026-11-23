import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { shotState } from 'basalt-ui/data'
import { navTarget } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import {
  NotesList,
  notesControls,
} from '../../../../../packages/basalt-ui/blocks/notes-list/NotesList'
import { TODAY, notesQuery } from '../../demo/ref-inventory'

function NotesRoute(): ReactElement {
  const query = shotState(useQuery(notesQuery))
  return (
    <NotesList
      notes={query}
      now={TODAY}
      supplierHref={(supplierId) =>
        navTarget(linkOptions({ to: '/ref/suppliers/$id', params: { id: supplierId } }))
      }
    />
  )
}

export const Route = createFileRoute('/ref/notes')({
  staticData: { title: 'Notes' },
  validateSearch: notesControls.validateSearch,
  search: { middlewares: notesControls.middlewares },
  component: NotesRoute,
})
