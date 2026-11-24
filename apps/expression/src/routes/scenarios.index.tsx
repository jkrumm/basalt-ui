import { Link, createFileRoute } from '@tanstack/react-router'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { SCENARIO_INFO } from '../scenarios/scenario-info'

const store = defineControls({
  id: 'expression-index',
  scope: 'page',
  fields: { search: field.string('') },
})

/** The index: every scenario of the registry, narrowed by the search box over its id, title and question. */
function IndexRoute() {
  const phrase = store.useValues().search.trim().toLowerCase()
  const shown = SCENARIO_INFO.filter(
    ({ id, title, blurb }) =>
      phrase === '' || `${id} ${title} ${blurb}`.toLowerCase().includes(phrase),
  )
  return (
    <Page area="index">
      <PageBar
        title="Expression scenarios"
        search={{
          state: store.field.search,
          label: 'Search scenarios',
          placeholder: 'Title or question',
        }}
      />
      <Section title={`${shown.length} of ${SCENARIO_INFO.length} scenarios`}>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
          {shown.map(({ id, title, blurb }) => (
            <li key={id}>
              <Link
                to="/scenarios/$name"
                params={{ name: id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {title}
              </Link>
              <span className="text-muted-foreground"> — {blurb}</span>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/scenarios/')({
  staticData: { title: 'Scenarios' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: IndexRoute,
})
