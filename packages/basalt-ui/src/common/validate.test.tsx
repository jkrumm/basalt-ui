/**
 * The two validation shapes: `useValidateProps` says each thing ONCE and disappears in production,
 * `assertRequiredProps` throws a message that names the component and the prop (F-ERR-1).
 */
import { render } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactNode } from 'react'
import { requiredProp } from './errors'
import { assertRequiredProps, resetValidatedProps, useValidateProps } from './validate'

function Probe({ message, tick }: { message: string | null; tick: number }): ReactNode {
  useValidateProps('Probe', () => message, [message, tick])
  return <div>probe</div>
}

afterEach(() => {
  resetValidatedProps()
})

describe('useValidateProps', () => {
  test('logs a message once, however many times the effect re-runs', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { rerender } = render(<Probe message="[basalt] Probe: bad" tick={0} />)
      rerender(<Probe message="[basalt] Probe: bad" tick={1} />)
      rerender(<Probe message="[basalt] Probe: bad" tick={2} />)
      expect(spy.mock.calls.filter((c) => c[0] === '[basalt] Probe: bad')).toHaveLength(1)
    } finally {
      spy.mockRestore()
    }
  })

  test('says a SECOND distinct message from the same component', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { rerender } = render(<Probe message="[basalt] Probe: one" tick={0} />)
      rerender(<Probe message="[basalt] Probe: two" tick={1} />)
      const said = spy.mock.calls.map((c) => c[0])
      expect(said).toContain('[basalt] Probe: one')
      expect(said).toContain('[basalt] Probe: two')
    } finally {
      spy.mockRestore()
    }
  })

  test('says nothing when the check returns null, or an array of nulls', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<Probe message={null} tick={0} />)
      render(<ArrayProbe />)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  test('is a no-op in production', () => {
    const previous = process.env['NODE_ENV']
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      process.env['NODE_ENV'] = 'production'
      render(<Probe message="[basalt] Probe: prod" tick={0} />)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
      if (previous === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = previous
    }
  })
})

function ArrayProbe(): ReactNode {
  useValidateProps('ArrayProbe', () => [null, undefined], [])
  return <div>array</div>
}

describe('assertRequiredProps', () => {
  test('throws a message naming the component and the prop', () => {
    expect(() => {
      assertRequiredProps('SelectFilter', { field: undefined }, ['field'])
    }).toThrow('[basalt] SelectFilter: prop "field" is required.')
  })

  test('carries the hint when one is given', () => {
    expect(() => {
      assertRequiredProps('SelectFilter', { field: undefined }, ['field'], {
        field: 'bind it to a store field',
      })
    }).toThrow(requiredProp('SelectFilter', 'field', 'bind it to a store field'))
  })

  test('throws on null as well as undefined, and passes on a present prop', () => {
    expect(() => {
      assertRequiredProps('X', { a: null }, ['a'])
    }).toThrow('prop "a" is required')
    expect(() => {
      assertRequiredProps('X', { a: 0, b: '' }, ['a', 'b'])
    }).not.toThrow()
  })

  test('throws in production too — the read was going to crash either way', () => {
    const previous = process.env['NODE_ENV']
    try {
      process.env['NODE_ENV'] = 'production'
      expect(() => {
        assertRequiredProps('X', { a: undefined }, ['a'])
      }).toThrow('[basalt] X: prop "a" is required.')
    } finally {
      if (previous === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = previous
    }
  })
})
