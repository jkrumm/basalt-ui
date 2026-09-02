/**
 * `mergeRefs`/`assignRef` under the React 19 rules: `ref` is an ordinary prop, and a callback ref
 * that returns a cleanup is never re-invoked with `null`. The interesting case is the MIXED one —
 * one callback returns a cleanup, one does not — because that is where a naive fan-out leaves a
 * ref pointing at a detached node.
 */
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { createRef, useRef } from 'react'
import type { ReactNode, Ref } from 'react'
import { assignRef, mergeRefs } from './refs'

describe('assignRef', () => {
  test('writes into a ref object', () => {
    const ref = createRef<string>()
    assignRef(ref, 'node')
    expect(ref.current).toBe('node')
  })

  test('calls a callback ref and returns its cleanup when it has one', () => {
    const seen: Array<string | null> = []
    const cleanup = assignRef((value: string | null) => {
      seen.push(value)
      return () => {
        seen.push('cleaned')
      }
    }, 'node')
    expect(seen).toEqual(['node'])
    expect(typeof cleanup).toBe('function')
    cleanup?.()
    expect(seen).toEqual(['node', 'cleaned'])
  })

  test('returns undefined for a callback with no cleanup, and for null/undefined refs', () => {
    expect(assignRef(() => {}, 'node')).toBeUndefined()
    expect(assignRef(null, 'node')).toBeUndefined()
    expect(assignRef(undefined, 'node')).toBeUndefined()
  })
})

function Host({ outer }: { outer: Ref<HTMLDivElement> }): ReactNode {
  const inner = useRef<HTMLDivElement>(null)
  return <div ref={mergeRefs(outer, inner)} data-testid="host" />
}

describe('mergeRefs', () => {
  test('fans one node out to a ref object and a callback ref', () => {
    const object = createRef<HTMLDivElement>()
    const seen: Array<HTMLDivElement | null> = []
    const { unmount } = render(
      <div
        ref={mergeRefs<HTMLDivElement>(object, (node) => {
          seen.push(node)
        })}
      />,
    )
    expect(object.current).not.toBeNull()
    expect(seen[0]).toBe(object.current)
    unmount()
    expect(object.current).toBeNull()
    expect(seen[1]).toBeNull()
  })

  test('runs a returned cleanup on unmount AND clears the refs that returned none', () => {
    const object = createRef<HTMLDivElement>()
    let cleaned = false
    const { unmount } = render(
      <div
        ref={mergeRefs<HTMLDivElement>(object, () => () => {
          cleaned = true
        })}
      />,
    )
    expect(object.current).not.toBeNull()
    unmount()
    expect(cleaned).toBe(true)
    // The mixed case: React never calls the merged ref with `null`, so mergeRefs has to.
    expect(object.current).toBeNull()
  })

  test('composes a forwarded ref with the component own ref', () => {
    const outer = createRef<HTMLDivElement>()
    const { getByTestId } = render(<Host outer={outer} />)
    expect(outer.current).toBe(getByTestId('host') as HTMLDivElement)
  })

  test('tolerates undefined entries', () => {
    const object = createRef<HTMLDivElement>()
    render(<div ref={mergeRefs<HTMLDivElement>(undefined, object)} />)
    expect(object.current).not.toBeNull()
  })
})
