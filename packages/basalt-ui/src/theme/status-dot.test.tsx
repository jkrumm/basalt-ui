import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusDot } from './status-dot'

test('StatusDot is an aria-hidden dot whose colour arrives as a custom property', () => {
  const markup = renderToStaticMarkup(<StatusDot color="var(--vx-status-bad)" />)
  expect(markup).toContain('aria-hidden="true"')
  expect(markup).toContain('data-basalt-status-dot')
  expect(markup).toContain('--basalt-status-dot:var(--vx-status-bad)')
})
