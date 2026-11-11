import { Toast as BaseToast } from '@base-ui/react/toast'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { dialogs } from '../core/messages/dialogs'
import { useMessages } from '../core/messages/use-messages'
import { connectNotifyHost } from '../core/notify'
import type { NotifyEntry } from '../core/notify'
import { Button } from '../ui/button'
import { Toast, ToastClose, ToastDescription, ToastTitle, ToastViewport } from '../ui/toast'

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

const TONE: Record<string, Tone> = { error: 'bad', success: 'good', warning: 'warn', info: 'info' }

type ToastData = { revert?: () => void }

function Stack(): ReactElement {
  const t = useMessages(dialogs)
  const manager = BaseToast.useToastManager<ToastData>()
  const { add, close, toasts } = manager

  useEffect(() => {
    const show = (entry: NotifyEntry): void => {
      add({
        id: entry.id,
        type: entry.kind,
        priority: entry.priority,
        timeout:
          entry.undo === undefined || entry.timeout === 0
            ? entry.timeout
            : Math.max(entry.timeout, entry.undo.windowMs),
        title: entry.title ?? entry.message,
        ...(entry.title === undefined ? {} : { description: entry.message }),
        ...(entry.undo === undefined ? {} : { data: { revert: entry.undo.revert } }),
      })
    }
    return connectNotifyHost({ add: show, close: (id) => close(id) })
  }, [add, close])

  return (
    <ToastViewport className="print:hidden">
      {toasts.map((toast) => {
        const revert = toast.data?.revert
        return (
          <Toast key={toast.id} toast={toast} tone={TONE[toast.type ?? ''] ?? 'neutral'}>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <ToastTitle />
              <ToastDescription />
              {revert === undefined ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    revert()
                    close(toast.id)
                  }}
                >
                  {t('toast.undo')}
                </Button>
              )}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
    </ToastViewport>
  )
}

/**
 * The one toast host: mount it once, inside the app, as an explicit child. It drains the `notify`
 * queue (anything sent before it mounted included) into the viewport and never moves focus. An
 * error is announced urgently (mirrored into a `role=alert`), everything else politely.
 *
 * @useWhen the app calls `notify`
 * @neverWhen the app has no toasts: leaving it out keeps Base UI Toast out of the bundle
 *
 * @example
 * <ToastHost />
 */
export function ToastHost(): ReactElement {
  return (
    <BaseToast.Provider limit={3}>
      <Stack />
    </BaseToast.Provider>
  )
}
