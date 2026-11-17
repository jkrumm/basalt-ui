import { createFileRoute } from '@tanstack/react-router'
import { Facts, Page, PageBar, Section } from 'basalt-ui/page'
import { recordOf } from '../demo/peek-records'

export const Route = createFileRoute('/peek/$id')({
  staticData: { title: 'Peek' },
  component: PeekRecordPage,
})

/** A record's own page: what the peek's `Open full page` link and a modifier click open. */
function PeekRecordPage() {
  const { id } = Route.useParams()
  const record = recordOf(id)
  return (
    <Page area="peek">
      <PageBar title={record?.title ?? `Record ${id}`} />
      <Section title="Facts">
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
      </Section>
    </Page>
  )
}
