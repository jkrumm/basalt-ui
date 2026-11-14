/**
 * `useFormDraft` under SSR: the server render and the hydrating render agree (the draft restores
 * after mount), a throwing `localStorage` getter never breaks it, and a component that reads
 * storage during render is the negative control that does mismatch.
 */
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { FormLike } from '../core/ports'
import { persisted } from '../core/persisted'
import { useFormDraft } from './draft'

type Values = { title: string }
const defaults: Values = { title: 'server' }
const schema = {
  '~standard': {
    version: 1 as const,
    vendor: 'test',
    validate: (v: unknown) => ({ value: v as Values }),
  },
}

function fakeForm(): FormLike<Values> {
  let state = { values: defaults, isSubmitting: false, canSubmit: true, errors: [] as unknown[] }
  return {
    get state() {
      return state
    },
    options: { defaultValues: defaults },
    store: { subscribe: () => ({ unsubscribe() {} }) },
    reset(values) {
      state = { ...state, values }
    },
  }
}

const form = fakeForm()
function Good() {
  const draft = useFormDraft(form, { key: 'ssr', version: 1, schema, owner: null })
  return <p>{draft.status}</p>
}
function Bad() {
  const raw = typeof window === 'undefined' ? null : window.localStorage.getItem('basalt:form:ssr')
  return <p>{raw === null ? 'none' : 'read'}</p>
}

function quietly<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

async function hydrate(
  Component: () => React.ReactElement,
): Promise<{ errors: number; text: string }> {
  // The server has no storage: render with the key absent, hydrate with it present.
  const stored = quietly(() => localStorage.getItem('basalt:form:ssr'))
  quietly(() => localStorage.removeItem('basalt:form:ssr'))
  const html = renderToString(<Component />)
  if (stored) quietly(() => localStorage.setItem('basalt:form:ssr', stored))
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  let errors = 0
  await act(async () => {
    hydrateRoot(host, <Component />, { onRecoverableError: () => void (errors += 1) })
  })
  const text = host.textContent ?? ''
  host.remove()
  return { errors, text }
}

beforeEach(() => {
  persisted.setStorage({
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => window.localStorage.removeItem(k),
  })
  localStorage.setItem('basalt:form:ssr', JSON.stringify({ v: 1, value: { title: 'draft' } }))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('useFormDraft under SSR', () => {
  test('hydrates with no recoverable error, then restores', async () => {
    const result = await hydrate(Good)
    expect(result.errors).toBe(0)
    expect(result.text).toBe('restored')
  })

  test('negative control: reading storage in render is a hydration mismatch', async () => {
    const result = await hydrate(Bad)
    expect(result.errors).toBeGreaterThan(0)
  })

  test('a throwing localStorage getter never breaks the hook', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    try {
      const result = await hydrate(Good)
      expect(result.errors).toBe(0)
      expect(result.text).toBe('none')
    } finally {
      Object.defineProperty(window, 'localStorage', original)
    }
  })
})
