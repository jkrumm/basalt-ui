import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Markdown } from './markdown'

const SOURCE =
  '# Heading\n\nSome **bold** text with a [link](https://example.com).\n\n- one\n- two\n'

const variants = [
  ['settled', false],
  ['streaming', true],
] as const

describe('renderToString', () => {
  test.each(variants)('%s output already contains the rendered text', (_label, streaming) => {
    const out = renderToString(
      <Markdown contentTrust="untrusted" streaming={streaming}>
        {SOURCE}
      </Markdown>,
    )

    expect(out).toContain('<h1>Heading</h1>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('<li>two</li>')
  })

  test.each(variants)(
    '%s output has no fallback, template or Suspense marker',
    (_label, streaming) => {
      const out = renderToString(
        <Markdown contentTrust="untrusted" streaming={streaming}>
          {SOURCE}
        </Markdown>,
      )

      expect(out).not.toContain('<template')
      expect(out).not.toContain('<!--$')
      expect(out).not.toContain('white-space')
      expect(out).not.toContain('# Heading')
    },
  )

  test('a streaming tail is repaired on the server too', () => {
    const out = renderToString(
      <Markdown contentTrust="untrusted" streaming>
        some **bold
      </Markdown>,
    )

    expect(out).toContain('<strong>bold</strong>')
  })
})

describe('hydrateRoot', () => {
  const recovered: unknown[] = []
  let errors: ReturnType<typeof spyOn<Console, 'error'>>
  beforeEach(() => {
    recovered.length = 0
    errors = spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    errors.mockRestore()
    document.body.innerHTML = ''
  })

  test.each(variants)('%s markup hydrates with no mismatch', async (_label, streaming) => {
    const tree = (
      <Markdown contentTrust="untrusted" streaming={streaming}>
        {SOURCE}
      </Markdown>
    )
    const container = document.createElement('div')
    document.body.append(container)
    container.innerHTML = renderToString(tree)
    const before = container.innerHTML

    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError: (error) => recovered.push(error) })
    })

    expect(errors).not.toHaveBeenCalled()
    expect(recovered).toEqual([])
    expect(container.innerHTML).toBe(before)
  })
})
