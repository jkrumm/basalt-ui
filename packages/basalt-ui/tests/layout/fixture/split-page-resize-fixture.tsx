/**
 * The `split-page-resize` fixture: `SplitPage` with a resizable list (`resize={{ id: 'mail' }}`), on its own
 * markup with no shell and no provider. The list is a `nav` of rows and the pane a paragraph; the wrapper is
 * the `@container` the tiers read.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { SplitPage } from '../../../src/page/parts/split-page'

const ROWS = ['Inbox', 'Sent', 'Drafts', 'Archive', 'Spam', 'Trash']

function Fixture(): ReactElement {
  return (
    <main className="p-4">
      <div className="@container w-full">
        <SplitPage
          selected={false}
          resize={{ id: 'mail' }}
          list={() => (
            <nav>
              {ROWS.map((row) => (
                <a key={row} href={'#' + row} className="block p-2">
                  {row}
                </a>
              ))}
            </nav>
          )}
          detail={() => <p>Pane</p>}
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
