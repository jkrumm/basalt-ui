/**
 * The `flow-canvas` fixture: a reorder workflow on a `FlowCanvas` in a 1200 x 600 box, a panel
 * beside it that a button docks and undocks (the frame shrinks, never covered) and a `FlowChecklist`
 * in the panel. One issue sits on the ERP row. The edges join two group headers, a header to a group,
 * and a row to a row, so a fold moves a row anchor onto its header. No shell. Probes: `fc-root`,
 * `fc-frame`, `fc-panel`, `fc-toggle`.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { FlowCanvas } from '../../src/cards/flow-canvas'
import { FlowChecklist } from '../../src/cards/flow-checklist'
import { useFlow } from '../../src/cards/flow'
import type { FlowColumn, FlowEdge, FlowIssue } from '../../src/cards/flow'

const COLUMNS: FlowColumn[] = [
  {
    id: 'start',
    groups: [
      {
        id: 'trigger',
        title: 'When',
        rows: [
          {
            id: 'below-point',
            title: 'Stock falls below the reorder point',
            sub: 'Main warehouse',
          },
          { id: 'tagged', title: 'Tagged Critical or Long lead' },
        ],
      },
      {
        id: 'schedule',
        title: 'Schedule',
        chip: { label: 'Weekdays' },
        rows: [
          { id: 'daily', title: 'Every weekday at 07:00', sub: 'Europe/Berlin' },
          { id: 'holidays', title: 'Skip public holidays' },
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
        chip: { label: '3 rules' },
        rows: [
          { id: 'supplier-ok', title: 'Supplier is Preferred or Approved' },
          { id: 'no-open-order', title: 'No open order for the part' },
          { id: 'under-limit', title: 'Order value under 5,000' },
        ],
      },
      {
        id: 'approval',
        title: 'Approval',
        rows: [
          { id: 'buyer', title: 'The buyer approves', sub: 'Mara Okafor' },
          { id: 'escalate', title: 'Escalate after one working day' },
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
        rows: [
          { id: 'draft-po', title: 'Draft a purchase order' },
          { id: 'email', title: 'Email the order to the supplier' },
          { id: 'erp', title: 'Post the order to the ERP', sub: 'Not connected' },
        ],
      },
      {
        id: 'runs',
        title: 'Recent runs',
        rows: [
          { id: 'run-41', title: 'Mon 23 Nov, 07:00', status: { tone: 'good', label: 'Done' } },
          { id: 'run-40', title: 'Fri 20 Nov, 07:00', status: { tone: 'warn', label: 'Waiting' } },
        ],
      },
    ],
  },
]

const EDGES: FlowEdge[] = [
  { from: 'trigger', to: 'conditions' },
  { from: 'schedule', to: 'conditions' },
  { from: 'approval', to: 'order' },
  { from: 'under-limit', to: 'erp' },
  { from: 'conditions', to: 'approval' },
]

const ISSUES: FlowIssue[] = [
  { id: 'erp', label: 'Connect the ERP', hint: 'Then, step 3', on: { row: 'erp' } },
]

function Fixture(): ReactElement {
  const flow = useFlow({ id: 'fixture' })
  const [docked, setDocked] = useState(true)
  return (
    <main lang="en" data-testid="fc-root" className="flex flex-col gap-4 p-4 text-foreground">
      <button type="button" data-testid="fc-toggle" onClick={() => setDocked((d) => !d)}>
        Toggle panel
      </button>
      <div className="flex h-150 w-300 max-w-full min-w-0 border">
        <div data-testid="fc-frame" className="flex min-w-0 flex-1 flex-col">
          <FlowCanvas label="Reorder" flow={flow} columns={COLUMNS} edges={EDGES} issues={ISSUES} />
        </div>
        {docked && (
          <aside
            data-testid="fc-panel"
            aria-label="Workflow"
            className="w-90 shrink-0 border-l p-4"
          >
            <FlowChecklist flow={flow} issues={ISSUES} />
          </aside>
        )}
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
