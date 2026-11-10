/**
 * `persisted` under SSR: the server HTML and the first hydrating client render agree, so a stored
 * value never causes a recoverable hydration error. A negative control proves the counter can fail.
 */
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { persisted } from './persisted'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

const stored = (key: string, value: unknown): void =>
  localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: 1, value }))

/** Hydrates `html` into the document and returns how many recoverable errors React reported. */
async function hydrate(
  html: string,
  element: React.ReactElement,
): Promise<{
  errors: number
  container: HTMLElement
}> {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)
  let errors = 0
  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: () => void (errors += 1) })
  })
  return { errors, container }
}

describe('persisted — SSR', () => {
  test('renderToString outputs the initial value although storage holds another', () => {
    const p = persisted('ssr-initial', { version: 1, initial: 'initial' })
    stored('ssr-initial', 'stored')
    function View() {
      return <span>{p.use()[0]}</span>
    }
    expect(renderToString(<View />)).toContain('initial')
    expect(renderToString(<View />)).not.toContain('stored')
  })

  test('hydration has zero recoverable errors, then shows the stored value', async () => {
    const p = persisted('ssr-hydrate', { version: 1, initial: 'initial' })
    stored('ssr-hydrate', 'stored')
    function View() {
      return <span>{p.use()[0]}</span>
    }
    const html = renderToString(<View />)
    const { errors, container } = await hydrate(html, <View />)
    expect(errors).toBe(0)
    expect(container.textContent).toBe('stored')
  })

  test('negative control: reading localStorage in render raises recoverable errors', async () => {
    function Naive() {
      const raw = localStorage.getItem('basalt:ssr-control')
      return <span>{raw === null ? 'server' : 'client'}</span>
    }
    const html = renderToString(<Naive />)
    expect(html).toContain('server')
    stored('ssr-control', 'stored')
    const { errors } = await hydrate(html, <Naive />)
    expect(errors).toBeGreaterThan(0)
  })

  test('a throwing window.localStorage getter never throws', async () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      const p = persisted('ssr-throwing', { version: 1, initial: 'initial' })
      function View() {
        return <span>{p.use()[0]}</span>
      }
      expect(() => renderToString(<View />)).not.toThrow()
      const { errors, container } = await hydrate(renderToString(<View />), <View />)
      expect(errors).toBe(0)
      expect(container.textContent).toBe('initial')
      expect(p.get()).toBe('initial')
      act(() => expect(() => p.set('chosen')).not.toThrow())
      expect(p.get()).toBe('chosen')
    } finally {
      if (real) Object.defineProperty(window, 'localStorage', real)
    }
  })
})
