/**
 * The ai recipes: a pending approval never resolves without an explicit Approve or Deny, sources
 * keep only http(s) links, and an artifact preview is sandboxed without `allow-same-origin`.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { ArtifactAside } from './ai-artifacts'
import { Message } from './ai-approvals-sources'

afterEach(cleanup)

const input = { path: '/tmp/x' }
const pending = [
  {
    type: 'tool-rm',
    toolCallId: 'c1',
    state: 'approval-requested',
    input,
    approval: { id: 'a1' },
  },
] as const

function mount(respond: (r: { id: string; approved: boolean }) => void, parts = pending) {
  return render(createElement(Message, { parts, tools: ['rm'], respond }))
}

describe('approvals', () => {
  test('a pending approval resolves only on an explicit click', () => {
    const calls: unknown[] = []
    mount((r) => calls.push(r))
    expect(screen.getByText('Approve')).toBeTruthy()
    expect(calls).toEqual([])
  })

  test('Approve and Deny each send one response for the request id', () => {
    const calls: unknown[] = []
    mount((r) => calls.push(r))
    fireEvent.click(screen.getByText('Approve'))
    fireEvent.click(screen.getByText('Deny'))
    expect(calls).toEqual([
      { id: 'a1', approved: true },
      { id: 'a1', approved: false },
    ])
  })

  test('a settled tool shows no buttons', () => {
    mount(() => {}, [{ ...pending[0], state: 'output-denied' }] as never)
    expect(screen.queryByText('Approve')).toBeNull()
    fireEvent.click(screen.getByText('1 step'))
    expect(screen.getByText('rm: denied')).toBeTruthy()
  })
})

describe('sources', () => {
  test('dedupes by url and drops a non-http link', () => {
    const src = (url: string) => ({ type: 'source-url', sourceId: url, url }) as const
    const parts = [
      src('https://a.example/x'),
      src('https://a.example/x'),
      src('javascript:alert(1)'),
    ]
    mount(() => {}, parts as never)
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      'https://a.example/x',
    ])
  })
})

describe('artifacts', () => {
  test('an html preview is sandboxed with scripts only and a CSP', () => {
    const catalog = {} as never
    const { container } = render(
      createElement(ArtifactAside, {
        title: 'Artifact',
        catalog,
        versions: [{ kind: 'html', body: '<p>hi</p>' }],
      }),
    )
    const frame = container.querySelector('iframe') ?? document.querySelector('iframe')
    expect(frame?.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame?.getAttribute('srcdoc')).toContain('Content-Security-Policy')
  })
})
