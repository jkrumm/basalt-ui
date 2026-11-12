import { createRoot } from 'react-dom/client'
import { DataTable, VirtualDataTable, col, useDataTable } from 'lib'

type Row = { id: string; name: string; amount: number; state: string }

const STATES = ['Engineering', 'Design', 'Sales', 'Support'] as const
const ROWS: Row[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Project ${(i * 7919) % 10_000}`,
  amount: (i * 104_729) % 99_991,
  state: STATES[i % STATES.length] ?? 'Sales',
}))

function App({ mode }: { mode: 'virtual' | 'dom' }) {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'rows',
    label: 'Rows',
    columns: [
      c.text('name', { header: 'Name' }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.status('state', { options: STATES, filter: 'multi', header: 'State' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  } as never)
  return mode === 'virtual' ? <VirtualDataTable table={t} /> : <DataTable table={t} />
}

const mode = new URLSearchParams(location.search).get('mode') === 'dom' ? 'dom' : 'virtual'
createRoot(document.getElementById('app') as HTMLElement).render(<App mode={mode} />)

const raf = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))

/** Click a sort header, wait two animation frames, return the elapsed ms. */
;(window as unknown as { sortOnce: (header: string) => Promise<number> }).sortOnce = async (
  header,
) => {
  const button = Array.from(document.querySelectorAll<HTMLElement>('th button')).find(
    (el) => el.textContent?.trim().startsWith(header) === true,
  )
  if (button === undefined) throw new Error(`no sort header ${header}`)
  const start = performance.now()
  button.click()
  await raf()
  await raf()
  return performance.now() - start
}
