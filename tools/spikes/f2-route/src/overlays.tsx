import { defineOverlays } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'

export type ConfirmPayload = { body: string; confirmLabel: string; onConfirm: () => void }

/** argo's `overlays.confirm({ title, body, danger, onConfirm })`, as one typed registry entry. */
export const OVERLAYS = defineOverlays({
  'workout:delete': {
    title: 'Delete workout',
    size: 'sm',
    render: (p: ConfirmPayload, api) => (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{p.body}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={api.close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              p.onConfirm()
              api.close()
            }}
          >
            {p.confirmLabel}
          </Button>
        </div>
      </div>
    ),
  },
})
