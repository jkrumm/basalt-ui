import { useFormat } from 'basalt-ui'
import { Facts } from 'basalt-ui/page'
import { navTarget } from 'basalt-ui/router'
import { EntityChip } from 'basalt-ui/ui/entity'
import { linkOptions } from '@tanstack/react-router'
import { Factory } from 'lucide-react'
import type { ReactElement } from 'react'
import { VISIT_LABELS } from './ref-schedule'
import type { Visit } from './ref-schedule'

/** One schedule entry as its record: what the peek and the entry's own page show. */
export function VisitFacts({ visit }: { visit: Visit }): ReactElement {
  const f = useFormat()
  const when =
    visit.allDay === true
      ? f.date(visit.start, 'long')
      : `${f.date(visit.start, 'long')}, ${f.time(visit.start)} to ${f.time(visit.end)}`
  return (
    <div data-shot="visit" className="flex flex-col gap-4">
      <Facts
        rows={[
          { label: 'Kind', value: VISIT_LABELS[visit.kind] },
          { label: 'When', value: when },
          {
            label: 'Supplier',
            value:
              visit.supplierId === null || visit.supplier === null ? (
                'None'
              ) : (
                <EntityChip
                  label={visit.supplier}
                  href={navTarget(
                    linkOptions({ to: '/ref/suppliers/$id', params: { id: visit.supplierId } }),
                  )}
                  avatar={{ shape: 'object', icon: Factory }}
                />
              ),
          },
          { label: 'Order', value: visit.order ?? 'None' },
          { label: 'Dock', value: visit.dock ?? 'None' },
          { label: 'People', value: visit.attendees?.join(', ') ?? 'None' },
        ]}
      />
      <p className="m-0 text-sm text-pretty">{visit.note}</p>
    </div>
  )
}
