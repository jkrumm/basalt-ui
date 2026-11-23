import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { EmptyState, Facts, Page, PageBar } from 'basalt-ui/page'
import { navTarget } from 'basalt-ui/router'
import { Lozenge } from 'basalt-ui/ui/badge'
import { Package } from 'lucide-react'
import type { ReactElement } from 'react'
import { partFacts } from '../../demo/part-facts'
import { partOf, STOCK_LABELS, STOCK_TONE } from '../../demo/ref-inventory'

export const Route = createFileRoute('/ref/part/$id')({
  staticData: { title: 'Part' },
  component: PartRoute,
})

/** A part's own page: what a relationship card's peek opens in full, and a modifier click. */
function PartRoute(): ReactElement {
  const { id } = Route.useParams()
  const part = partOf(id)
  const parent = { label: 'Parts', href: navTarget(linkOptions({ to: '/ref/parts' })) }
  if (part === undefined) {
    return (
      <Page area="ref-part">
        <PageBar title="Part" parent={parent} />
        <EmptyState cause={`No part has the id ${id}.`} />
      </Page>
    )
  }
  return (
    <Page area="ref-part">
      <PageBar
        title={part.name}
        identity={{
          avatar: { shape: 'object', icon: Package },
          subtitle: part.sku,
          tags: <Lozenge tone={STOCK_TONE[part.stock]}>{STOCK_LABELS[part.stock]}</Lozenge>,
        }}
        parent={parent}
      />
      <Facts rows={partFacts(part)} />
    </Page>
  )
}
