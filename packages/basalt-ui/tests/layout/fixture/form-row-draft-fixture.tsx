/**
 * The `form-row-draft` fixture (docs/v3/issues/cycles/v3-state-1-draft-formrow.json, state-1.4): an
 * edit form in a `Sheet` open on first mount, the way a record opened from the URL reloads. The
 * form arrives after a load, `useFormDraft` restores a stored draft whose amount differs from the
 * server value, and the restoring render also shows "Draft restored" above the row and reads a
 * width, as a page's width store does. That commit is what left a `FormRow` 0 px tall.
 *
 * The form is TanStack-shaped (`FormLike`): `reset` notifies its store, and the restored values and
 * the "restored" status land in one commit, as they did in the app.
 */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { useFormDraft } from '../../../src/controls/draft'
import { FormField } from '../../../src/controls/form-field'
import { FormRow } from '../../../src/controls/form-row'
import { persisted } from '../../../src/core/persisted'
import type { FieldLike, FormLike } from '../../../src/core/ports'
import { Fieldset, Form } from '../../../src/ui/field'
import { NumberField } from '../../../src/ui/number-field'
import { Select } from '../../../src/ui/select'
import { Sheet, SheetContent } from '../../../src/ui/sheet'

type Values = { status: string; amount: number }

const SERVER: Values = { status: 'paid', amount: 8319 }
const DRAFT: Values = { status: 'paid', amount: 4321 }
const OWNER = 'fixture'
const KEY = 'order'
const OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
]

const schema = {
  '~standard': {
    version: 1 as const,
    vendor: 'fixture',
    validate(value: unknown) {
      const v = value as Record<string, unknown> | null
      const ok = v !== null && typeof v['status'] === 'string' && typeof v['amount'] === 'number'
      return ok ? { value: value as Values } : { issues: [{ message: 'rejected' }] }
    },
  },
}

/** The draft a previous visit left: the user changed the amount and the autosave ran. */
persisted<Values | null>(`form:${OWNER}:${KEY}`, { version: 1, initial: null, schema }).set(DRAFT)

type DraftForm = FormLike<Values> & { setValue<K extends keyof Values>(k: K, v: Values[K]): void }

function createForm(defaults: Values): DraftForm {
  let state = { values: defaults, isSubmitting: false, canSubmit: true, errors: [] as unknown[] }
  const subs = new Set<() => void>()
  const emit = (): void => subs.forEach((cb) => cb())
  return {
    get state() {
      return state
    },
    options: { defaultValues: defaults },
    store: {
      subscribe(cb) {
        subs.add(cb)
        return { unsubscribe: () => void subs.delete(cb) }
      },
    },
    reset(values) {
      state = { ...state, values }
      emit()
    },
    setValue(k, v) {
      state = { ...state, values: { ...state.values, [k]: v } }
      emit()
    },
  }
}

/** Subscribed before `useFormDraft`'s effect, so the restore's values and its status share one commit. */
function useValues(form: DraftForm): Values {
  const [values, setValues] = useState(form.state.values)
  useEffect(() => {
    const sub = form.store.subscribe(() => setValues(form.state.values))
    return () => sub.unsubscribe()
  }, [form])
  return values
}

function fieldOf<K extends keyof Values>(
  form: DraftForm,
  values: Values,
  k: K,
): FieldLike<Values[K]> {
  return {
    state: { value: values[k], meta: { errors: [] } },
    handleChange: (v) => form.setValue(k, v),
    handleBlur() {},
  }
}

/** The fixture mounts one record, so one form for the page. */
const form = createForm(SERVER)

function EditForm(): ReactElement {
  const values = useValues(form)
  const draft = useFormDraft(form, { key: KEY, version: 1, schema, owner: OWNER })
  // The restoring render reads a width, as `Page`'s width store does when the page re-renders with
  // it: a forced layout between the mount and the restore's commit.
  if (draft.status === 'restored') void document.body.offsetWidth
  return (
    <Form noValidate>
      <Fieldset>
        <output className="m-0 block text-sm text-muted-foreground empty:hidden">
          {draft.status === 'restored' ? 'Draft restored from this device.' : null}
        </output>
        <FormRow>
          <FormField label="Status" field={fieldOf(form, values, 'status')}>
            <Select aria-label="Status" options={OPTIONS} />
          </FormField>
          <FormField
            label="Amount (EUR)"
            description="Above 50,000 needs approval."
            field={fieldOf(form, values, 'amount')}
          >
            <NumberField min={0} format={{ style: 'currency', currency: 'EUR' }} />
          </FormField>
        </FormRow>
      </Fieldset>
    </Form>
  )
}

/** The record loads first, then the form mounts in one synchronous commit, as a resolved query does. */
function Record(): ReactElement {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => flushSync(() => setLoaded(true)), 250)
    return () => clearTimeout(timer)
  }, [])
  return loaded ? <EditForm /> : <p className="m-0 text-sm text-muted-foreground">Loading</p>
}

function Fixture(): ReactElement {
  return (
    <Sheet open>
      <SheetContent title="Edit order" className="md:w-120">
        <Record />
      </SheetContent>
    </Sheet>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
