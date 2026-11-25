/**
 * The default detail sheet and the `table-expand` door (docs/v3/concepts/data-table.md section 6):
 * `detail` opens its own box in the sheet, `onRowActivate` keeps the tap and the door opens the
 * derived sheet, neither lets the tap open the derived sheet; a caller's host wins over the sheet.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import { settled } from '../../testing/settled'
import { col } from '../core/kinds'
import { useDataTable } from '../use-data-table'
import type { UseDataTable } from '../contract'
import { DataTable } from './data-table'
import { PageHostContext, ShellOverlayContext } from '../../page/page'
import { fakeHost } from '../../page/page.test-support'
import { presentationStore } from '../../page/core/panel-store'

afterEach(cleanup)

type Row = { id: string; name: string; amount: number; state: string }
const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', amount: 12, state: 'Open' },
  { id: 'b', name: 'Beta', amount: 7, state: 'Done' },
]
const c = col<Row>()

function Subject({
  options = {},
  host,
}: {
  options?: Partial<UseDataTable<Row>>
  host?: { isOpen: boolean; show(entry: unknown): void; hide(): void }
}): ReactElement {
  const t = useDataTable<Row>({
    id: 'sheet-test',
    label: 'Orders',
    columns: [
      c.entity('name', { header: 'Name' }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.status('state', { header: 'State', options: ['Open', 'Done'], priority: 3 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...options,
  } as UseDataTable<Row>)
  return <DataTable table={t} {...(host !== undefined && { detail: host as never })} />
}

const row = (n: number): HTMLElement =>
  document.querySelectorAll<HTMLElement>('tbody tr')[n] as HTMLElement
const sheet = (): HTMLElement | null => document.querySelector('[data-slot="sheet-content"]')

describe('neither detail nor onRowActivate', () => {
  test('a row tap opens a sheet titled by the identity, listing every column with its value', async () => {
    render(<Subject />)
    expect(document.querySelector('[data-slot="table-expand"]')).toBeNull()
    fireEvent.click(row(0))
    await settled()
    const panel = sheet() as HTMLElement
    expect(panel.querySelector('[data-slot="sheet-title"]')?.textContent).toBe('Alpha')
    const labels = [...panel.querySelectorAll('dt')].map((dt) => dt.textContent)
    expect(labels).toEqual(['Name', 'Amount (EUR)', 'State'])
    expect(panel.textContent).toContain('Open')
  })

  test('Enter on the row opens it too', async () => {
    render(<Subject />)
    fireEvent.keyDown(row(1), { key: 'Enter' })
    await settled()
    expect(sheet()?.querySelector('[data-slot="sheet-title"]')?.textContent).toBe('Beta')
  })
})

describe('detail', () => {
  test("opens the caller's box in the default sheet and shows no door", async () => {
    render(<Subject options={{ detail: (r: Row) => <p>Box of {r.name}</p> }} />)
    expect(document.querySelector('[data-slot="table-expand"]')).toBeNull()
    fireEvent.click(row(0))
    await settled()
    expect(sheet()?.textContent).toContain('Box of Alpha')
  })

  test('a host prop wins: the sheet stays closed and the host gets the entry', async () => {
    const show = mock((_entry: unknown) => undefined)
    render(
      <Subject
        options={{ detail: (r: Row) => <p>Box of {r.name}</p> }}
        host={{ isOpen: false, show, hide: () => undefined }}
      />,
    )
    fireEvent.click(row(0))
    await settled()
    expect(show).toHaveBeenCalledTimes(1)
    expect(sheet()).toBeNull()
  })
})

describe('detailPresent without a shell', () => {
  test('drawer is a sheet that leaves the page live: no scrim, nothing inert', async () => {
    render(
      <Subject
        options={{ detailPresent: 'drawer', detail: (r: Row) => <p>Box of {r.name}</p> } as never}
      />,
    )
    fireEvent.click(row(0))
    await settled()
    expect(sheet()?.textContent).toContain('Box of Alpha')
    expect(document.querySelector('.bg-scrim')).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
  })
})

describe('onRowActivate and the Details door', () => {
  test('the tap navigates; the door opens the derived sheet and does not activate', async () => {
    const onRowActivate = mock((_row: Row) => undefined)
    render(<Subject options={{ onRowActivate }} />)
    const door = screen.getAllByRole('button', { name: 'Details' })
    expect(door).toHaveLength(2)
    expect(door[0]?.closest('[data-slot="table-expand"]')).not.toBeNull()
    await act(async () => {
      fireEvent.click(door[1] as HTMLElement)
    })
    await settled()
    expect(onRowActivate).not.toHaveBeenCalled()
    expect(sheet()?.querySelector('[data-slot="sheet-title"]')?.textContent).toBe('Beta')
    expect(sheet()?.textContent).toContain('Done')
  })

  test('no door while no column can be hidden by a tier', () => {
    render(
      <Subject
        options={{
          onRowActivate: () => undefined,
          columns: [c.entity('name', { header: 'Name' }), c.money('amount', { currency: 'EUR' })],
        }}
      />,
    )
    expect(document.querySelector('[data-slot="table-expand"]')).toBeNull()
  })
})

describe('under a shell', () => {
  const original = window.matchMedia
  const wide = (): void => {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  }
  afterEach(() => {
    window.matchMedia = original
    presentationStore('sheet-test').reset()
  })
  function Shelled({ region, data = ROWS }: { region: HTMLElement; data?: Row[] }): ReactElement {
    const { host } = fakeHost()
    return (
      <PageHostContext value={host}>
        <ShellOverlayContext value={region}>
          <Subject options={{ data, detail: (r: Row) => <p>Box of {r.name}</p> }} />
        </ShellOverlayContext>
      </PageHostContext>
    )
  }
  const peek = (): HTMLElement | null => document.querySelector('[data-slot="peek"]')

  test('a row opens its record in a non-modal peek remembered per table, with no sheet and no scrim', async () => {
    wide()
    const region = document.createElement('div')
    document.body.append(region)
    render(<Shelled region={region} />)
    fireEvent.click(row(0))
    await settled()
    expect(peek()?.textContent).toContain('Box of Alpha')
    expect(sheet()).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open as' })).toBeTruthy()
    region.remove()
  })

  test('detailPresent: drawer opens the record as a drawer on the surface until the reader picks another', async () => {
    wide()
    const surface = document.createElement('div')
    surface.dataset['slot'] = 'shell-surface'
    const region = document.createElement('div')
    surface.append(region)
    document.body.append(surface)
    const { host } = fakeHost()
    render(
      <PageHostContext value={host}>
        <ShellOverlayContext value={region}>
          <Subject
            options={
              {
                id: 'drawer-test',
                detailPresent: 'drawer',
                detail: (r: Row) => <p>Box of {r.name}</p>,
              } as never
            }
          />
        </ShellOverlayContext>
      </PageHostContext>,
    )
    fireEvent.click(row(0))
    await settled()
    expect(peek()?.dataset['present']).toBe('drawer')
    expect(surface.contains(peek())).toBe(true)
    expect(peek()?.textContent).toContain('Box of Alpha')
    // the page's own rows stay: a second row swaps the record in the same drawer
    fireEvent.click(row(1))
    await settled()
    expect(document.querySelectorAll('[data-slot="peek"]').length).toBe(1)
    expect(peek()?.textContent).toContain('Box of Beta')
    presentationStore('drawer-test').reset()
    surface.remove()
  })

  test("previous and next step through the table's rows in place and stop at the ends", async () => {
    wide()
    const region = document.createElement('div')
    document.body.append(region)
    render(<Shelled region={region} />)
    fireEvent.click(row(0))
    await settled()
    const prev = screen.getByRole('button', { name: 'Previous record' }) as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }))
    await settled()
    expect(peek()?.textContent).toContain('Box of Beta')
    expect(
      (screen.getByRole('button', { name: 'Next record' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    region.remove()
  })

  test('the steps follow the order the rows have now, not the order they had when the record opened', async () => {
    wide()
    const region = document.createElement('div')
    document.body.append(region)
    const { rerender } = render(<Shelled region={region} />)
    fireEvent.click(row(0))
    await settled()
    const prev = (): HTMLButtonElement =>
      screen.getByRole('button', { name: 'Previous record' }) as HTMLButtonElement
    expect(prev().disabled).toBe(true)
    // The rows re-order with the record open (a sort, a filter, a refetch): Alpha is now last.
    rerender(<Shelled region={region} data={[...ROWS].reverse()} />)
    await settled()
    expect(prev().disabled).toBe(false)
    expect(
      (screen.getByRole('button', { name: 'Next record' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(prev())
    await settled()
    expect(document.querySelector('[data-slot="peek"]')?.textContent).toContain('Box of Beta')
    region.remove()
  })

  test('Escape closes it and focus goes back to the row', async () => {
    wide()
    const region = document.createElement('div')
    document.body.append(region)
    render(<Shelled region={region} />)
    row(1).focus()
    fireEvent.keyDown(row(1), { key: 'Enter' })
    await settled()
    expect(document.activeElement).toBe(peek())
    await act(async () => {
      fireEvent.keyDown(peek() as HTMLElement, { key: 'Escape' })
      await Promise.resolve()
    })
    expect(peek()).toBeNull()
    expect(document.activeElement).toBe(row(1))
    region.remove()
  })

  test("a caller's host gets the rows in order as the entry's records", async () => {
    const show = mock((_entry: unknown) => undefined)
    render(
      <Subject
        options={{ detail: (r: Row) => <p>Box of {r.name}</p> }}
        host={{ isOpen: false, show, hide: () => undefined }}
      />,
    )
    fireEvent.click(row(1))
    await settled()
    const entry = show.mock.calls[0]?.[0] as { records?: { ids: string[]; id: string } }
    expect(entry.records?.ids).toEqual(['a', 'b'])
    expect(entry.records?.id).toBe('b')
  })
})
