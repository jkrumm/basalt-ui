/**
 * `cardStateProps`: the error placeholder a Meter or BarList card takes.
 */
import { describe, expect, it } from 'bun:test'
import { cardStateProps } from './shot-state'

describe('cardStateProps', () => {
  it.each([undefined, 'empty', 'loading'] as const)(
    'at %s the card only reserves its body height',
    (state) => {
      expect(cardStateProps(state, 'boom', 72)).toEqual({ placeholderHeight: 72 })
    },
  )

  it('on error it carries the message, a retry and the body height', () => {
    const props = cardStateProps('error', 'Top lifts failed to load.', 184)
    expect(props.placeholderHeight).toBe(184)
    expect(props.state?.error).toBeInstanceOf(Error)
    expect(String(props.state?.error)).toBe('Error: Top lifts failed to load.')
    expect(typeof props.onRetry).toBe('function')
    expect('stateAction' in props).toBe(false)
  })
})
