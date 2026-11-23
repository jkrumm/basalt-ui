import { createFileRoute } from '@tanstack/react-router'
import { FlowCanvas, FlowChecklist, useFlow } from 'basalt-ui/cards'
import type { FlowCanvasProps } from 'basalt-ui/cards'
import { Facts, Page, PageAside, PageBar, Section, useSizeClass } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import {
  AlarmClock,
  BadgeCheck,
  CalendarClock,
  CalendarOff,
  Clock,
  Euro,
  FilePlus,
  FileText,
  Funnel,
  Mail,
  PackageMinus,
  PackageSearch,
  PanelRight,
  Play,
  Plug,
  Tags,
  UserCheck,
  Zap,
} from 'lucide-react'
import type { ReactElement } from 'react'

/**
 * The panel's open state lives in the address, so a shared link opens the builder as it was left: docked
 * and open by default on a wide screen, a closed sheet on a phone, where the canvas is the page.
 */
const store = defineControls({
  id: 'ref-flow',
  scope: 'page',
  fields: { details: field.boolean(true), sheet: field.boolean(false) },
})

type FlowColumn = FlowCanvasProps['columns'][number]
type FlowEdge = NonNullable<FlowCanvasProps['edges']>[number]
type FlowIssue = NonNullable<FlowCanvasProps['issues']>[number]

const groupMenu = (name: string) =>
  [
    { id: 'rename', label: `Rename ${name}`, onClick: () => undefined },
    { id: 'remove', label: `Remove ${name}`, onClick: () => undefined },
  ] as const

/** The reorder workflow of the parts inventory, one stage a column: a trigger, its conditions, an approval and the purchase order. */
const COLUMNS: FlowColumn[] = [
  {
    id: 'start',
    groups: [
      {
        id: 'trigger',
        title: 'When',
        icon: Zap,
        rows: [
          {
            id: 'below-minimum',
            title: 'Stock drops under its minimum',
            sub: 'Any part in the main warehouse',
            icon: PackageMinus,
          },
          { id: 'tagged', title: 'Tagged Critical or Imported', icon: Tags },
        ],
      },
      {
        id: 'schedule',
        title: 'Schedule',
        icon: CalendarClock,
        chip: { label: 'Weekdays' },
        rows: [
          { id: 'daily', title: 'Every weekday at 07:00', sub: 'Berlin time', icon: Clock },
          { id: 'holidays', title: 'Skip public holidays', icon: CalendarOff },
        ],
      },
    ],
  },
  {
    id: 'decide',
    groups: [
      {
        id: 'conditions',
        title: 'If',
        icon: Funnel,
        chip: { label: '3 rules' },
        menu: groupMenu('conditions'),
        rows: [
          {
            id: 'supplier-ok',
            title: 'Supplier is Preferred or Approved',
            sub: 'Probation suppliers wait for a buyer',
            icon: BadgeCheck,
          },
          { id: 'no-open-order', title: 'No open order for the part', icon: PackageSearch },
          { id: 'under-limit', title: 'Order value under €5,000', icon: Euro },
        ],
      },
    ],
  },
  {
    id: 'approve',
    groups: [
      {
        id: 'approval',
        title: 'Approval',
        icon: UserCheck,
        chip: { label: 'Over €2,000' },
        menu: groupMenu('approval'),
        rows: [
          {
            id: 'buyer',
            title: 'The part’s buyer approves',
            sub: 'Mara Okafor for bearings and seals',
            icon: UserCheck,
          },
          {
            id: 'escalate',
            title: 'Escalate after one working day',
            sub: 'To the purchasing lead',
            icon: AlarmClock,
          },
        ],
      },
    ],
  },
  {
    id: 'act',
    groups: [
      {
        id: 'order',
        title: 'Then',
        icon: FileText,
        chip: { label: '3 steps' },
        menu: groupMenu('steps'),
        rows: [
          {
            id: 'draft-po',
            title: 'Draft a purchase order',
            sub: 'The quantity set on the part',
            icon: FilePlus,
          },
          {
            id: 'email',
            title: 'Email the order to the supplier',
            sub: 'PDF attached',
            icon: Mail,
          },
          {
            id: 'books',
            title: 'Record the order in the accounts',
            sub: 'Accounting app not connected',
            icon: Plug,
          },
        ],
      },
    ],
  },
]

const EDGES: FlowEdge[] = [
  { from: 'trigger', to: 'conditions' },
  { from: 'schedule', to: 'conditions' },
  { from: 'conditions', to: 'approval' },
  { from: 'approval', to: 'order' },
]

const ISSUES: FlowIssue[] = [
  {
    id: 'books',
    label: 'Connect the accounting app so step 3 can record the order',
    hint: 'Then · Record the order in the accounts',
    on: { row: 'books' },
  },
]

/**
 * The reference builder: the reorder workflow on a canvas of group cards with connectors, the panel
 * docked beside it with the checklist and who owns the workflow. The one open issue (the accounting app is
 * not connected) marks its step, its group, the edge into the group and the checklist.
 */
function FlowRoute(): ReactElement {
  const flow = useFlow({ id: 'ref-reorder' })
  const panel = useSizeClass() === 'compact' ? store.field.sheet : store.field.details
  const [open, setOpen] = panel.use()
  return (
    <Page area="ref-flow" fill>
      <PageBar
        actions={[
          { kind: 'text', id: 'state', text: 'Active', mobile: 'hidden' },
          {
            id: 'details',
            label: open ? 'Hide details' : 'Show details',
            icon: PanelRight,
            onClick: () => setOpen(!open),
          },
          { id: 'run', label: 'Run now', icon: Play, primary: true, onClick: () => undefined },
        ]}
      />
      <div data-shot="flow" className="flex min-h-0 flex-1 flex-col">
        <FlowCanvas
          label="Reorder workflow"
          flow={flow}
          columns={COLUMNS}
          edges={EDGES}
          issues={ISSUES}
        />
      </div>
      <PageAside title="Workflow" width={360} dock="always" state={panel} mobile="sheet">
        <div className="flex flex-col gap-8">
          <Section title={ISSUES.length === 1 ? '1 open issue' : `${ISSUES.length} open issues`}>
            <FlowChecklist flow={flow} issues={ISSUES} />
          </Section>
          <Section title="Ownership">
            <Facts
              rows={[
                { label: 'Owner', value: 'Jonas Lindqvist' },
                { label: 'Team', value: 'Purchasing' },
                { label: 'Notifies', value: 'The purchasing channel' },
              ]}
            />
          </Section>
        </div>
      </PageAside>
    </Page>
  )
}

export const Route = createFileRoute('/ref/flow')({
  staticData: { title: 'Reorder workflow' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: FlowRoute,
})
