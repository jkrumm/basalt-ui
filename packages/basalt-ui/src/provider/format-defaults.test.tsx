import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltProvider } from './index'
import { testRouter } from './test-router'
import { defineFormat, integer } from '../format'

afterEach(() => {
  cleanup()
  defineFormat()
})

describe('BasaltProvider locale / timeZone', () => {
  test('locale sets the default every formatter reads; a per-call locale overrides', async () => {
    const router = testRouter('x', () => (
      <>
        <span>{`default:${integer(1112)}`}</span>
        <span>{`call:${integer(1112, { locale: 'de-DE' })}`}</span>
      </>
    ))
    render(<BasaltProvider router={router} locale="en-US" />)
    expect(await screen.findByText('default:1,112')).toBeTruthy()
    expect(await screen.findByText('call:1.112')).toBeTruthy()
  })
})
