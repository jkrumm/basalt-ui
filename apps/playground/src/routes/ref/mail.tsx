import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { shotState } from 'basalt-ui/data'
import { navTarget } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { Mailbox, mailControls } from '../../../../../packages/basalt-ui/blocks/mailbox/Mailbox'
import { TODAY } from '../../demo/ref-inventory'
import { mailQuery } from '../../demo/ref-mail'

function MailRoute(): ReactElement {
  const query = shotState(useQuery(mailQuery))
  return (
    <Mailbox
      conversations={query}
      now={TODAY}
      supplierHref={(supplierId) =>
        navTarget(linkOptions({ to: '/ref/suppliers/$id', params: { id: supplierId } }))
      }
      onSend={() => undefined}
    />
  )
}

export const Route = createFileRoute('/ref/mail')({
  staticData: { title: 'Mail' },
  validateSearch: mailControls.validateSearch,
  search: { middlewares: mailControls.middlewares },
  component: MailRoute,
})
