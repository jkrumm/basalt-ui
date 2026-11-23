import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Page, Section } from 'basalt-ui/page'
import { Combobox } from 'basalt-ui/ui/combobox'
import type { ListItems, ListLoader } from 'basalt-ui/ui/combobox'
import { Select } from 'basalt-ui/ui/select'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import type { ReactElement } from 'react'
import { useSpecimen } from './-specimen'

const REGIONS: ListItems = [
  {
    label: 'Europe',
    options: [
      { value: 'fra', label: 'Frankfurt', hint: 'eu-central-1' },
      { value: 'dub', label: 'Dublin', hint: 'eu-west-1' },
      { value: 'sto', label: 'Stockholm', hint: 'eu-north-1' },
    ],
  },
  {
    label: 'Americas',
    options: [
      { value: 'iad', label: 'Virginia', hint: 'us-east-1' },
      { value: 'pdx', label: 'Oregon', hint: 'us-west-2' },
      {
        value: 'gru',
        label: 'São Paulo',
        description: 'Not on your plan',
        hint: 'sa-east-1',
        disabled: true,
      },
    ],
  },
  {
    label: 'Asia Pacific',
    options: [
      { value: 'nrt', label: 'Tokyo', hint: 'ap-northeast-1' },
      { value: 'sin', label: 'Singapore', hint: 'ap-southeast-1' },
      { value: 'syd', label: 'Sydney', hint: 'ap-southeast-2' },
    ],
  },
]

const person = (value: string, label: string, description: string) => ({
  value,
  label,
  description,
  avatar: { name: label },
})

const OWNERS: ListItems = [
  {
    label: 'Agents',
    options: [
      person('planner', 'Planner', 'Breaks a goal into steps'),
      person('reviewer', 'Reviewer', 'Reads a change before it ships'),
      person('writer', 'Writer', 'Drafts release notes'),
    ],
  },
  {
    label: 'People',
    options: [
      person('ada', 'Ada Byrne', 'Platform lead'),
      person('jonas', 'Jonas Eck', 'Site reliability'),
      person('mira', 'Mira Holt', 'Finance'),
      person('sam', 'Sam Ortiz', 'Support'),
    ],
  },
]

const REPOS = [
  'billing-api',
  'billing-web',
  'checkout',
  'design-system',
  'docs-site',
  'edge-proxy',
  'inventory',
  'mobile-app',
  'notifications',
  'search-indexer',
  'status-page',
  'warehouse-sync',
]

/** A server search stand-in: answers after a short wait and stops when the next query aborts it. */
const searchRepos: ListLoader = (query, { signal }) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase()
      resolve(
        REPOS.filter((name) => name.includes(needle)).map((name) => ({
          value: name,
          label: name,
          hint: `${(name.length * 7) % 40} issues`,
        })),
      )
    }, 150)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

const KINDS = ['Bearing', 'Bolt', 'Bracket', 'Gasket', 'Hinge', 'Spring', 'Valve', 'Washer']

/** Ten thousand parts: the list mounts the rows in view through `VirtualList`. */
const PARTS = Array.from({ length: 10_000 }, (_, i) => ({
  value: `P-${String(i + 1).padStart(5, '0')}`,
  label: `P-${String(i + 1).padStart(5, '0')} · ${KINDS[i % KINDS.length] ?? 'Part'}`,
  hint: `${(i * 37) % 500} in stock`,
}))

/** Which list the page opens: `?open=region`, `owner`, `repository` or `part` (one at a time for a shot). */
type OpenList = 'region' | 'owner' | 'repository' | 'part'
const OPEN_LISTS: readonly OpenList[] = ['region', 'owner', 'repository', 'part']

function Lists({ open }: { open: OpenList | undefined }): ReactElement {
  const region = useSpecimen<string | null>('fra')
  const owner = useSpecimen<string | null>('ada')
  const repo = useSpecimen<string | null>(null)
  const part = useSpecimen<string | null>('P-00042')
  return (
    <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">
      <FormField
        label="Region"
        description="Select with groups, a hint per option and a search field."
        field={region}
      >
        <Select
          aria-label="Region"
          options={REGIONS}
          searchable
          placeholder="Choose a region"
          defaultOpen={open === 'region'}
        />
      </FormField>
      <FormField
        label="Owner"
        description="Grouped faces; a name that is not listed can be added."
        field={owner}
      >
        <Combobox
          aria-label="Owner"
          options={OWNERS}
          placeholder="Search people and agents"
          onCreate={(text) => text.trim().toLowerCase()}
          defaultOpen={open === 'owner'}
        />
      </FormField>
      <FormField
        label="Repository"
        description="Loaded per query; a slow answer never replaces a newer one."
        field={repo}
      >
        <Combobox
          aria-label="Repository"
          options={searchRepos}
          placeholder="Search repositories"
          defaultOpen={open === 'repository'}
        />
      </FormField>
      <FormField
        label="Part"
        description="Ten thousand options; only the rows in view mount."
        field={part}
      >
        <Combobox
          aria-label="Part"
          options={PARTS}
          virtual={VirtualList}
          placeholder="Search parts"
          defaultOpen={open === 'part'}
        />
      </FormField>
    </div>
  )
}

export const Route = createFileRoute('/kit/forms/lists')({
  staticData: { title: 'Option lists' },
  validateSearch: (raw: Record<string, unknown>): { open?: OpenList } => {
    const open = OPEN_LISTS.find((id) => id === raw['open'])
    return open === undefined ? {} : { open }
  },
  component: ListsRoute,
})

/**
 * The one list engine, a list opened by `?open=`: a grouped Select with a search field, grouped faces with a
 * create row, a list loaded per query and ten thousand windowed rows. Mod+K opens the command
 * palette, which draws the same row at its larger size with the commands grouped.
 */
function ListsRoute(): ReactElement {
  const { open } = Route.useSearch()
  return (
    <Page area="kit-forms-lists">
      <Section
        title="Option lists"
        summary="One option row in Select, Combobox and the palette: groups, faces, a loader and ten thousand rows."
      >
        <Lists open={open} />
      </Section>
    </Page>
  )
}
