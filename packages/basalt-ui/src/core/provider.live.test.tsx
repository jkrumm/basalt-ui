/**
 * `BasaltProvider live`: the binding starts once when the provider mounts on the client, survives a
 * rerender, stops on unmount, and a server render starts nothing.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { BasaltProvider } from './provider'

afterEach(cleanup)

const counting = () => {
  const calls = { start: 0, stop: 0 }
  const live = {
    start: () => {
      calls.start += 1
      return () => void (calls.stop += 1)
    },
  }
  return { calls, live }
}

describe('BasaltProvider live', () => {
  test('starts once on mount, not again on rerender, stops on unmount', () => {
    const { calls, live } = counting()
    const view = render(<BasaltProvider live={live}>x</BasaltProvider>)
    expect(calls).toEqual({ start: 1, stop: 0 })
    view.rerender(
      <BasaltProvider live={live} locale="de">
        x
      </BasaltProvider>,
    )
    expect(calls).toEqual({ start: 1, stop: 0 })
    view.unmount()
    expect(calls).toEqual({ start: 1, stop: 1 })
  })

  test('a server render starts nothing', () => {
    const { calls, live } = counting()
    renderToString(<BasaltProvider live={live}>x</BasaltProvider>)
    expect(calls).toEqual({ start: 0, stop: 0 })
  })

  test('no live starts nothing', () => {
    render(<BasaltProvider>x</BasaltProvider>).unmount()
  })
})
