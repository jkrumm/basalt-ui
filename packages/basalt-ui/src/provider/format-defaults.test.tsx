import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltProvider } from './index'
import { testRouter } from './test-router'
import { defineFormat, integer, weekday } from '../format'
import { resetFormatDefaults } from '../format/shared'

afterEach(() => {
  cleanup()
  resetFormatDefaults()
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

  test('an unset prop leaves the current default in place', async () => {
    defineFormat({ locale: 'de-DE' })
    const router = testRouter('x', () => <span>{`n:${integer(1112)}`}</span>)
    render(<BasaltProvider router={router} />)
    expect(await screen.findByText('n:1.112')).toBeTruthy()
  })

  test('timeZone applies to the date formatters', async () => {
    const at = new Date('2026-09-02T23:30:00Z')
    const router = testRouter('x', () => <span>{`day:${weekday(at)}`}</span>)
    render(<BasaltProvider router={router} locale="en-US" timeZone="Asia/Tokyo" />)
    expect(await screen.findByText('day:Thu')).toBeTruthy()
  })
})
