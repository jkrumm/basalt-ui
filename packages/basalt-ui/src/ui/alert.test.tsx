import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Alert, alertParts } from './alert'

afterEach(cleanup)

describe('alert module', () => {
  test('the part carries data-slot and alertParts lists it', () => {
    const { container } = render(<Alert>Saved</Alert>)
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...alertParts])
  })

  test('server render keeps the slot', () => {
    expect(renderToString(<Alert tone="bad">Failed</Alert>)).toContain('data-slot="alert"')
  })

  const roles = [
    ['bad', 'alert'],
    ['warn', 'alert'],
    ['good', 'status'],
    ['info', 'status'],
    ['accent', 'status'],
    ['neutral', 'status'],
  ] as const
  for (const [tone, role] of roles) {
    test(`${tone} is announced as ${role}`, () => {
      const { getByRole } = render(<Alert tone={tone}>Body</Alert>)
      expect(getByRole(role).getAttribute('data-slot')).toBe('alert')
    })
  }

  test('no tone reads as neutral', () => {
    const { getByRole } = render(<Alert>Body</Alert>)
    expect(getByRole('status').className).toContain('bg-selected')
  })

  test('title and body are both printed', () => {
    const { getByText } = render(
      <Alert tone="warn" title="Heads up">
        Disk is nearly full
      </Alert>,
    )
    expect(getByText('Heads up')).toBeTruthy()
    expect(getByText('Disk is nearly full')).toBeTruthy()
  })
})
