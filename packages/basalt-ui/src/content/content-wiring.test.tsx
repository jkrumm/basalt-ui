/**
 * `Markdown` with fences and headings (docs/v3/concepts/ai-mdx.md C10 to C12): the model-controlled
 * fence language never reaches a renderer through the prototype chain, a throwing renderer leaves
 * the block's text visible, the streaming tail shows its fences as code without a copy button, and
 * headings carry deduplicated ids and an anchor.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Markdown } from './markdown'
import type { FenceRenderers } from './contract'
import { settledOnly } from './fences'

afterEach(cleanup)

let warn: ReturnType<typeof spyOn>
beforeEach(() => {
  warn = spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => warn.mockRestore())

const fence = (lang: string, body: string): string => `\`\`\`${lang}\n${body}\n\`\`\``

describe('Markdown — fence registry', () => {
  test.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'a %s fence never reaches a renderer and shows as code',
    (lang) => {
      const calls: string[] = []
      const fenceRenderers: FenceRenderers = {
        ok: ({ lang: l }) => {
          calls.push(l)
          return <i />
        },
      }
      const { container } = render(
        <Markdown contentTrust="untrusted" fenceRenderers={fenceRenderers}>
          {fence(lang, 'visible body')}
        </Markdown>,
      )
      expect(calls).toEqual([])
      expect(container.querySelector('pre')?.textContent).toContain('visible body')
    },
  )

  test('a consumer renderer receives its fence', () => {
    const fenceRenderers: FenceRenderers = { note: ({ code }) => <mark>{code}</mark> }
    const { container } = render(
      <Markdown contentTrust="untrusted" fenceRenderers={fenceRenderers}>
        {fence('note', 'hello')}
      </Markdown>,
    )
    expect(container.querySelector('mark')?.textContent).toBe('hello')
  })

  test('a throwing renderer leaves the text visible', () => {
    const fenceRenderers: FenceRenderers = {
      json: () => {
        throw new Error('boom')
      },
    }
    const { container } = render(
      <Markdown contentTrust="untrusted" fenceRenderers={fenceRenderers}>
        {fence('json', '{ broken')}
      </Markdown>,
    )
    expect(container.querySelector('pre')?.textContent).toContain('{ broken')
  })

  test('the streaming tail shows its fence as code, a settled block upgrades it', () => {
    const fenceRenderers: FenceRenderers = {
      note: settledOnly(({ code }) => <mark>{code}</mark>),
    }
    const text = `${fence('note', 'first')}\n\nbetween\n\n${fence('note', 'second')}`
    const { container, queryAllByRole } = render(
      <Markdown contentTrust="untrusted" streaming fenceRenderers={fenceRenderers}>
        {text}
      </Markdown>,
    )
    expect([...container.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['first'])
    expect(container.querySelector('pre')?.textContent).toContain('second')
    expect(queryAllByRole('button')).toHaveLength(0)
  })
})

describe('Markdown — headings', () => {
  test('ids are slugged and repeats are suffixed', () => {
    render(
      <Markdown contentTrust="untrusted">
        {'## Setup\n\ntext\n\n## Setup\n\n### Other thing'}
      </Markdown>,
    )
    expect(screen.getAllByRole('heading').map((h) => h.id)).toEqual([
      'setup',
      'setup-1',
      'other-thing',
    ])
  })

  test('every heading links to itself', () => {
    const { container } = render(<Markdown contentTrust="untrusted">{'# Title'}</Markdown>)
    expect(container.querySelector('h1 a[href="#title"]')).not.toBeNull()
  })

  test('a consumer component still overrides the default heading', () => {
    render(
      <Markdown contentTrust="untrusted" components={{ h1: ({ children }) => <h2>{children}</h2> }}>
        {'# Title'}
      </Markdown>,
    )
    expect(screen.getByRole('heading', { level: 2 }).id).toBe('')
  })
})

describe('Markdown — mermaid fences from a model', () => {
  test('an injection in a node label leaves no executable markup', async () => {
    const { container } = render(
      <Markdown contentTrust="untrusted">
        {'~~~mermaid\ngraph TD\n  A["<img src=x onerror=alert(1)>"] --> B\n~~~'}
      </Markdown>,
    )
    await waitFor(() => expect(container.querySelector('[data-slot="mermaid"] svg')).not.toBeNull())
    expect(container.querySelector('svg script, svg img, [onerror], [onload]')).toBeNull()
  })
})
