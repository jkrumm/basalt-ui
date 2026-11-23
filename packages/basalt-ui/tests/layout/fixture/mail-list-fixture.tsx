/**
 * The `mail-list` fixture: `MailList` over 240 mails across a year, in a bounded list box with a
 * width the URL hash sets (`#w=320`), and a list-form `BulkBar` with four actions. No shell and no
 * provider. The selection is the fixture's own state.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { MailList } from '../../../src/cards/mail-list'
import type { MailItem } from '../../../src/cards/mail-list'
import { BulkBar } from '../../../src/table/parts/bulk-bar'
import { VirtualList } from '../../../src/ui/virtual-list'

const NOW = Date.UTC(2026, 10, 23, 9, 0)
const HOUR = 3_600_000
const NAMES = ['Erik Holm', 'Hannah Pryce', 'Lukas Gruber', 'Katrin Brenner', 'Inês Carvalho']

const ITEMS: MailItem[] = Array.from({ length: 240 }, (_, i) => ({
  id: `m${i}`,
  from: { name: NAMES[i % NAMES.length]!, org: { name: 'Supplier' } },
  subject: `Order confirmation PO-2026-${String(400 - i).padStart(4, '0')}`,
  snippet: 'We confirm the order in full. The confirmation is attached.',
  at: NOW - (i < 6 ? i : i * 30) * HOUR,
  unread: i % 4 === 0,
  ...(i % 3 === 0 && { entity: { label: `PO-2026-${String(400 - i).padStart(4, '0')}` } }),
}))

const width = Number(new URLSearchParams(location.hash.slice(1)).get('w') ?? '440')

function Fixture(): ReactElement {
  const [selected, setSelected] = useState<readonly string[]>([])
  const noop = (): void => undefined
  return (
    <main className="p-4">
      <div
        data-fixture="box"
        className="flex h-[600px] flex-col border border-border"
        style={{ width }}
      >
        <MailList
          label="Inbox"
          items={ITEMS}
          now={NOW}
          onOpen={noop}
          selected={selected}
          onSelectedChange={setSelected}
          actions={[]}
          virtual={VirtualList}
          bulk={
            <BulkBar
              count={selected.length}
              onClear={() => setSelected([])}
              actions={[
                { id: 'archive', label: 'Archive', onClick: noop },
                { id: 'read', label: 'Mark read', onClick: noop },
                { id: 'unread', label: 'Mark unread', onClick: noop },
                { id: 'delete', label: 'Delete', tone: 'danger', onClick: noop },
              ]}
            />
          }
        />
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
