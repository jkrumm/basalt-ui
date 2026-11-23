/**
 * `FlowCanvas` and `FlowChecklist`: groups and rows in source order as tab stops, the tools and
 * their keys, the zoom keys and menu, a fold that is remembered, issue marks on a header and a row,
 * and a checklist item that unfolds a group and focuses its row. Geometry (edges, fit) is the
 * layout test's, and so is the wheel: here nothing has a size.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { FlowCanvas } from './flow-canvas'
import { FlowChecklist } from './flow-checklist'
import { useFlow } from './flow'
import type { FlowColumn, FlowEdge, FlowIssue } from './flow'

const COLUMNS: FlowColumn[] = [
  {
    id: 'c1',
    groups: [
      {
        id: 'trigger',
        title: 'When',
        rows: [{ id: 'low', title: 'Stock below reorder point' }],
      },
    ],
  },
  {
    id: 'c2',
    groups: [
      {
        id: 'checks',
        title: 'If',
        chip: { label: '2 rules' },
        rows: [
          { id: 'supplier', title: 'Supplier is approved' },
          { id: 'budget', title: 'Within monthly budget' },
        ],
      },
    ],
  },
  {
    id: 'c3',
    groups: [
      {
        id: 'order',
        title: 'Then',
        rows: [
          { id: 'po', title: 'Draft a purchase order' },
          { id: 'erp', title: 'Send to the ERP' },
        ],
      },
    ],
  },
]

const EDGES: FlowEdge[] = [
  { from: 'trigger', to: 'checks' },
  { from: 'checks', to: 'order' },
]

const ISSUES: FlowIssue[] = [
  { id: 'i1', label: 'Connect the ERP', hint: 'Then, step 2', on: { row: 'erp' } },
  { id: 'i2', label: 'Name an approver', on: { group: 'order' }, tone: 'bad' },
]

let storeId = 0
beforeEach(() => {
  storeId += 1
  localStorage.clear()
})
afterEach(cleanup)

function Harness({ issues = ISSUES, id }: { issues?: FlowIssue[]; id?: string }): ReactElement {
  const flow = useFlow({ id: id ?? `test-${storeId}` })
  return (
    <div>
      <FlowCanvas label="Reorder" flow={flow} columns={COLUMNS} edges={EDGES} issues={issues} />
      <FlowChecklist flow={flow} issues={issues} />
    </div>
  )
}

const canvas = (): HTMLElement => document.querySelector<HTMLElement>('[data-slot="flow-canvas"]')!
const zoom = (): number => Number(canvas().dataset['zoom'])
const header = (name: string): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^${name}`) })

describe('FlowCanvas', () => {
  test('groups and rows are tab stops in source order, each row an anchor', () => {
    render(<Harness issues={[]} />)
    const stops = [
      ...canvas().querySelectorAll<HTMLElement>(
        '[data-slot="flow-group-header"], [data-slot="flow-row"]',
      ),
    ]
    expect(stops.map((el) => el.textContent?.trim().split(/\s{2,}/)[0])).toEqual([
      'When',
      'Stock below reorder point',
      'If2 rules',
      'Supplier is approved',
      'Within monthly budget',
      'Then',
      'Draft a purchase order',
      'Send to the ERP',
    ])
    for (const row of canvas().querySelectorAll<HTMLElement>('[data-slot="flow-row"]')) {
      expect(row.tabIndex).toBe(0)
      expect(row.dataset['flowAnchor']).toBeTruthy()
    }
    expect(screen.getByLabelText('Reorder').dataset['slot']).toBe('scroll-area')
  })

  test('the tools are pressed buttons; H and V switch them, never from a field', () => {
    render(<Harness issues={[]} />)
    const pointer = screen.getByRole('button', { name: 'Pointer' })
    const hand = screen.getByRole('button', { name: 'Hand' })
    expect(pointer.getAttribute('aria-pressed')).toBe('true')
    expect(hand.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(hand)
    expect(canvas().dataset['tool']).toBe('hand')
    fireEvent.keyDown(header('When'), { key: 'v' })
    expect(canvas().dataset['tool']).toBe('pointer')
    fireEvent.keyDown(header('When'), { key: 'H' })
    expect(canvas().dataset['tool']).toBe('hand')
    expect(hand.getAttribute('aria-pressed')).toBe('true')
    // Ctrl with V is the browser's paste, not a tool.
    fireEvent.keyDown(header('When'), { key: 'v', ctrlKey: true })
    expect(canvas().dataset['tool']).toBe('hand')
  })

  test('+, - and 0 zoom from inside the canvas, with or without Ctrl or Cmd, within 0.5 to 1.25', () => {
    render(<Harness issues={[]} />)
    expect(zoom()).toBe(1)
    expect(canvas().dataset['fitted']).toBe('')
    const row = canvas().querySelector<HTMLElement>('[data-slot="flow-row"]')!
    fireEvent.keyDown(row, { key: '+' })
    expect(zoom()).toBe(1.25)
    expect(canvas().dataset['fitted']).toBeUndefined()
    fireEvent.keyDown(row, { key: '=', metaKey: true })
    expect(zoom()).toBe(1.25)
    const down = fireEvent.keyDown(row, { key: '-', ctrlKey: true })
    expect(down).toBe(false) // the browser's own zoom is prevented
    expect(zoom()).toBe(1)
    for (let i = 0; i < 6; i++) fireEvent.keyDown(row, { key: '-' })
    expect(zoom()).toBe(0.5)
    fireEvent.keyDown(row, { key: '0', metaKey: true })
    expect(canvas().dataset['fitted']).toBe('')
  })

  test('the zoom menu sets 50, 100 and 125 per cent and fits; the step buttons stop at the range', () => {
    render(<Harness issues={[]} />)
    const menu = document.querySelector<HTMLElement>('[data-slot="flow-zoom-menu"]')!
    const presets = [...menu.querySelectorAll<HTMLElement>('[data-preset]')]
    expect(presets.map((p) => p.dataset['preset'])).toEqual(['0.5', '1', '1.25'])
    fireEvent.click(presets[0]!)
    expect(zoom()).toBe(0.5)
    expect(screen.getByRole('button', { name: 'Zoom out' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(presets[2]!)
    expect(zoom()).toBe(1.25)
    expect(screen.getByRole('button', { name: 'Zoom in' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Zoom to fit/ }))
    expect(canvas().dataset['fitted']).toBe('')
    expect(screen.getByRole('button', { name: /^Zoom, / }).textContent).toBe('100%')
  })

  test('a header folds its rows and the fold is remembered per flow', () => {
    const first = render(<Harness issues={[]} id="kept" />)
    const then = header('Then')
    expect(then.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(then)
    expect(then.getAttribute('aria-expanded')).toBe('false')
    const body = document.getElementById(then.getAttribute('aria-controls')!)!
    expect(body.hasAttribute('inert')).toBe(true)
    first.unmount()
    render(<Harness issues={[]} id="kept" />)
    expect(header('Then').getAttribute('aria-expanded')).toBe('false')
    expect(header('When').getAttribute('aria-expanded')).toBe('true')
  })

  test('an issue marks its group header with the count and its row; the header takes the worst tone', () => {
    render(<Harness />)
    const chip = canvas().querySelector<HTMLElement>(
      '[data-flow-group="order"] [data-flow-issues]',
    )!
    expect(chip.textContent).toBe('2 issues')
    expect(chip.className).toContain('text-bad')
    const erp = canvas().querySelector<HTMLElement>('[data-flow-anchor="erp"]')!
    expect(erp.dataset['issue']).toBe('warn')
    expect(erp.textContent).toContain('Issue: Connect the ERP')
    expect(canvas().querySelector('[data-flow-group="checks"] [data-flow-issues]')).toBeNull()
  })

  test('a checklist item unfolds the group and focuses the row', async () => {
    render(<Harness />)
    fireEvent.click(header('Then'))
    expect(header('Then').getAttribute('aria-expanded')).toBe('false')
    const items = [...document.querySelectorAll<HTMLElement>('[data-slot="flow-checklist-item"]')]
    expect(items.map((i) => i.textContent)).toEqual([
      'Connect the ERPThen, step 2',
      'Name an approver',
    ])
    await act(async () => {
      fireEvent.click(items[0]!)
    })
    expect(header('Then').getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(canvas().querySelector('[data-flow-anchor="erp"]'))
    await act(async () => {
      fireEvent.click(items[1]!)
    })
    expect(document.activeElement).toBe(header('Then'))
  })

  test('with no issue the checklist says all is set', () => {
    render(<Harness issues={[]} />)
    expect(document.querySelector('[data-slot="flow-checklist"]')!.textContent).toBe(
      'Everything it needs is in place',
    )
  })
})
