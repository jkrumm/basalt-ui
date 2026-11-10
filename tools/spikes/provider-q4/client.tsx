// Spike fixture: non-English overrides vs Base UI defaults, bundled by run.ts.
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Combobox, Toast } from '@base-ui/react'
import { ComboboxField, ComboboxPositioner, ToastViewport } from './wrappers'

const FRUITS = ['Apfel', 'Birne', 'Kirsche']
const manager = Toast.createToastManager()
const mode = new URLSearchParams(location.search).get('mode') ?? 'wrapped'
const wrapped = mode === 'wrapped'

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast}>
      <Toast.Title />
      <Toast.Description />
      <Toast.Close aria-label="Meldung schließen">×</Toast.Close>
    </Toast.Root>
  ))
}

function App() {
  const viewport = wrapped ? (
    <ToastViewport label="Benachrichtigungen">
      <ToastList />
    </ToastViewport>
  ) : (
    <Toast.Viewport>
      <ToastList />
    </Toast.Viewport>
  )
  const Field = wrapped ? ComboboxField : 'div'
  const Positioner = wrapped ? ComboboxPositioner : Combobox.Positioner
  const extra = wrapped ? { dismissLabel: 'Schließen' } : {}
  return (
    <main>
      <h1>Q4</h1>
      <button
        type="button"
        onClick={() =>
          manager.add({
            title: 'Gespeichert',
            description: 'Die Änderung ist übernommen.',
            timeout: 0,
          })
        }
      >
        Toast zeigen
      </button>
      <Toast.Provider toastManager={manager}>
        <Toast.Portal>{viewport}</Toast.Portal>
      </Toast.Provider>
      <Combobox.Root items={FRUITS}>
        <Field {...extra}>
          <Combobox.Input aria-label="Obst wählen" />
        </Field>
        <Combobox.Portal>
          <Positioner {...extra}>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
