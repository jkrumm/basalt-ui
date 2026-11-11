/**
 * The toast-viewport fixture (docs/v3/concepts/state-persistence-forms.md section 9): the real
 * `ToastHost` and `notify`, no shell and no provider. A notification is sent BEFORE the host
 * mounts (S5), and buttons send more.
 *
 * Probes, each a `data-testid`: `tv-error`, `tv-success`, `tv-undo`: send one notification;
 * `tv-page`: the page behind the viewport.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { notify } from '../../../src/core/notify'
import { ToastHost } from '../../../src/page/toast-host'
import { Button } from '../../../src/ui/button'

notify('info', { title: 'Queued', message: 'Sent before the host mounted.' })

let n = 0

function Fixture(): ReactElement {
  return (
    <main
      className="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground"
      data-testid="tv-page"
    >
      <h1 className="text-lg font-medium">Notifications</h1>
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="tv-error"
          onClick={() =>
            notify('error', { title: 'Upload failed', message: `Attempt ${(n += 1)} was refused.` })
          }
        >
          Error
        </Button>
        <Button
          data-testid="tv-success"
          onClick={() => notify('success', { message: `Saved ${(n += 1)}` })}
        >
          Success
        </Button>
        <Button
          data-testid="tv-undo"
          onClick={() =>
            notify('success', { message: `Deleted ${(n += 1)}`, undo: { revert: () => {} } })
          }
        >
          Undo
        </Button>
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(
  <>
    <Fixture />
    <ToastHost />
  </>,
)
