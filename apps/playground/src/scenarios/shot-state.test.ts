/**
 * `cardStateProps`: the error placeholder a Meter or BarList card takes.
 */
import { describe, expect, it } from 'bun:test'
import { cardStateProps } from './shot-state'

describe('cardStateProps', () => {
  it('at rest the card only reserves its body height', () => {
    expect(cardStateProps(undefined, 'boom', 72, 'none')).toEqual({ placeholderHeight: 72 })
  })

  it('loading and empty reach the card too, so its headline is not printed', () => {
    expect(cardStateProps('loading', 'boom', 72, 'none')).toEqual({
      state: { pending: true },
      placeholderHeight: 72,
    })
    expect(cardStateProps('empty', 'boom', 72, 'none')).toEqual({
      state: { empty: 'none' },
      placeholderHeight: 72,
    })
  })

  it("passes 'content' through so the card ends at its content", () => {
    expect(cardStateProps(undefined, 'boom', 'content', 'none')).toEqual({
      placeholderHeight: 'content',
    })
    expect(cardStateProps('error', 'boom', 'content', 'none').placeholderHeight).toBe('content')
  })

  it('on error it carries the message, a retry and the body height', () => {
    const props = cardStateProps('error', 'Top lifts failed to load.', 184, 'none')
    expect(props.placeholderHeight).toBe(184)
    expect(props.state?.error).toBeInstanceOf(Error)
    expect(String(props.state?.error)).toBe('Error: Top lifts failed to load.')
    expect(typeof props.onRetry).toBe('function')
    expect('stateAction' in props).toBe(false)
  })
})
