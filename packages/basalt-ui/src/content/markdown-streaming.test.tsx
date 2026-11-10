/**
 * `<Markdown streaming contentTrust="untrusted">` under a real token stream. Every prefix of a long
 * reply (char-by-char and in seeded random chunks) is rendered and held to the same invariants:
 *  - never throws;
 *  - no `streamdown:` sentinel reaches an `<img src>` / `<a href>`, and no remote `<img>` appears;
 *  - the final streamed output equals rendering the complete text in one go;
 *  - settled blocks are not re-rendered while the tail grows.
 */
import { act, render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { Markdown } from './markdown'

function ui(text: string, streaming = true) {
  return (
    <Markdown streaming={streaming} contentTrust="untrusted" images="same-origin">
      {text}
    </Markdown>
  )
}

/** Deterministic PRNG (mulberry32) so a failing chunking is reproducible from the seed. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function prefixes(text: string, chunk: () => number): string[] {
  const out: string[] = []
  let end = 0
  while (end < text.length) {
    end = Math.min(text.length, end + Math.max(1, chunk()))
    out.push(text.slice(0, end))
  }
  return out
}

function assertSafe(container: HTMLElement, at: string): void {
  const where = `at prefix ${JSON.stringify(at.slice(-40))}`
  for (const img of container.querySelectorAll('img')) {
    expect(img.getAttribute('src') ?? '', where).not.toContain('streamdown:')
    expect(img.getAttribute('src') ?? '', where).toMatch(/^\//)
  }
  for (const a of container.querySelectorAll('a')) {
    expect(a.getAttribute('href') ?? '', where).not.toContain('streamdown:')
  }
  expect(container.innerHTML, where).not.toContain('streamdown:')
  expect(container.innerHTML, where).not.toContain('evil.example')
  expect(container.querySelector('script, iframe, object, [onclick], [onerror]'), where).toBeNull()
}

const REPLY = [
  '# Title',
  '',
  'A paragraph with **bold**, *italic*, ~~strike~~ and `inline code`, a [link](https://example.com/docs?a=1)',
  'and an ![inline image](/assets/ok.png) plus a remote ![tracker](https://evil.example/p.png?q=secret).',
  '',
  '- item one',
  '  - nested **two**',
  '    - deep [x](https://example.com/deep)',
  '- item three',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '```ts',
  'const x: number = 1',
  '```',
  '',
  'Costs $5 and $10, and math $$x^2$$ done. <b onclick="x()">raw</b> <script>alert(1)</script>',
  '',
  'Last paragraph with a [dangling link](https://example.com/very/long',
].join('\n')

const COMPLETE_REPLY = `${REPLY})\n\n![end](/assets/end.png)\n`

describe('streaming matrix: every prefix is safe', () => {
  const cases: ReadonlyArray<readonly [string, () => number]> = [
    ['char by char', () => 1],
    [
      'random chunks (seed 1)',
      (
        (r) => () =>
          1 + Math.floor(r() * 12)
      )(rng(1)),
    ],
    [
      'random chunks (seed 42)',
      (
        (r) => () =>
          1 + Math.floor(r() * 40)
      )(rng(42)),
    ],
  ]

  for (const [name, chunk] of cases) {
    test(
      name,
      async () => {
        const { container, rerender } = render(ui(''))
        for (const prefix of prefixes(COMPLETE_REPLY, chunk)) {
          await act(async () => {
            rerender(ui(prefix))
          })
          assertSafe(container, prefix)
        }
        expect(container.querySelector('h1')).not.toBeNull()

        const reference = render(ui(COMPLETE_REPLY, false))
        expect(flat(container)).toBe(flat(reference.container))
      },
      60_000,
    )
  }
})

// Blocks render separately, so react-markdown's inter-block newlines are the only difference.
const flat = (el: HTMLElement) => el.innerHTML.replace(/>\s+</g, '><')

function tail(text: string): HTMLElement {
  return render(ui(text)).container
}

describe('streaming matrix: the tail constructs remend repairs', () => {
  test('unterminated link keeps its text, never an href', () => {
    const c = tail('see [the docs](https://example.com/a')

    expect(c.textContent).toContain('the docs')
    expect(c.querySelector('a[href]')).toBeNull()
    assertSafe(c, 'link')
  })

  test('unterminated image renders its alt text, never an <img>', () => {
    const c = tail('look: ![a diagram of the flow](/assets/flo')

    expect(c.querySelector('img')).toBeNull()
    expect(c.textContent).toContain('a diagram of the flow')
    expect(c.innerHTML).not.toContain('streamdown:')
  })

  test('half-typed image alt (no bracket closed yet) is inert text', () => {
    const c = tail('look: ![a dia')

    expect(c.querySelector('img')).toBeNull()
    assertSafe(c, 'alt')
  })

  test('a complete same-origin image renders as an <img> once allowed', () => {
    expect(tail('![ok](/assets/ok.png)').querySelector('img')?.getAttribute('src')).toBe(
      '/assets/ok.png',
    )
  })

  test.each([
    ['a **bold', 'strong'],
    ['an *italic', 'em'],
    ['a ~~gone', 'del'],
    ['some `code', 'code'],
  ])('%j closes into <%s> without leaking markers', (src, selector) => {
    const c = tail(src)

    expect(c.querySelector(selector)).not.toBeNull()
    expect(c.textContent).not.toMatch(/\*|~~|`/)
  })

  test('table header without a delimiter row renders as text, then as a table', () => {
    expect(tail('| a | b |').querySelector('table')).toBeNull()
    expect(tail('| a | b |\n|---|---|\n| 1 | 2 |').querySelector('table')).not.toBeNull()
  })

  test('a deeply nested list with an unclosed ** repairs inside the item', () => {
    expect(tail('- a\n  - b\n    - **c').querySelector('li li li strong')).not.toBeNull()
  })

  test('currency $ is left alone; an unterminated $$ block does not throw', () => {
    expect(tail('it costs $5 and $10 today').textContent).toContain('$5 and $10')
    expect(tail('so $$x^2').textContent).toContain('x^2')
  })

  test('an unterminated code fence shows its text in a <pre>', () => {
    expect(tail('```ts\nconst a = 1\nconst b').querySelector('pre')?.textContent).toContain(
      'const b',
    )
  })

  test('raw HTML in a streamed tail never becomes an element', () => {
    const c = tail('hi <img src=x onerror=alert(1)> <script>alert(1)</script> <custom')

    expect(c.querySelector('script, img[onerror]')).toBeNull()
    expect(c.innerHTML).not.toContain('onerror=')
  })
})

describe('streaming matrix: sentinels never become a destination', () => {
  test.each([
    '[half](https://example.com/very/lo',
    '![half](https://example.com/very/lo',
    '[half](',
    '![half](',
    '[half',
    '![half',
  ])('%j', (src) => {
    const c = tail(src)

    expect(c.innerHTML).not.toContain('streamdown:')
    expect(c.querySelector('img')).toBeNull()
    expect(c.querySelector('a[href]')).toBeNull()
  })
})

describe('streaming matrix: settled blocks stay memoized', () => {
  test('settled blocks do not re-render while the tail grows', async () => {
    let settledRenders = 0
    const Spy = ({ children }: { children?: React.ReactNode }) => {
      settledRenders++
      return <h2>{children}</h2>
    }
    const components = { h2: Spy }
    const view = (text: string) => (
      <Markdown streaming contentTrust="untrusted" components={components}>
        {text}
      </Markdown>
    )

    const head = '## settled heading\n\nsettled paragraph.\n\n'
    const { rerender, container } = render(view(`${head}tail`))
    const afterFirstPaint = settledRenders
    expect(afterFirstPaint).toBeGreaterThan(0)

    const tailText = 'the tail keeps growing one character at a time'
    for (let i = 1; i <= tailText.length; i++) {
      await act(async () => {
        rerender(view(`${head}${tailText.slice(0, i)}`))
      })
    }
    expect(container.textContent).toContain(tailText)
    expect(settledRenders).toBe(afterFirstPaint)
  })

  test('the tail block does re-render per token', async () => {
    let paragraphRenders = 0
    const Spy = ({ children }: { children?: React.ReactNode }) => {
      paragraphRenders++
      return <p>{children}</p>
    }
    const components = { p: Spy }
    const view = (text: string) => (
      <Markdown streaming contentTrust="untrusted" components={components}>
        {text}
      </Markdown>
    )
    const { rerender } = render(view('one'))
    const before = paragraphRenders
    await act(async () => {
      rerender(view('one two'))
    })

    expect(paragraphRenders).toBeGreaterThan(before)
  })

  test('a block settles when a blank line closes it, and keeps its rendering', async () => {
    const { rerender, container } = render(ui('first'))
    await act(async () => {
      rerender(ui('first\n\nsecond'))
    })

    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'first',
      'second',
    ])
  })
})

describe('dropped images keep their alt text (settled, untrusted)', () => {
  test('a refused remote image renders its alt as text; an empty alt renders nothing', () => {
    const { container } = render(
      <Markdown contentTrust="untrusted" images="same-origin">
        {'![probe alt](https://cdn.example/p.png) ![](https://cdn.example/q.png)'}
      </Markdown>,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toContain('cdn.example')
    expect(container.querySelector('p')?.querySelectorAll('span')).toHaveLength(1)
    expect(container.querySelector('span')?.textContent).toBe('probe alt')
  })
})
