import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { Element, Root } from 'hast'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from './markdown'
import type { MarkdownProps } from './markdown'

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

const upper = () => (tree: { children: { children?: { value?: string }[] }[] }) => {
  for (const child of tree.children) for (const leaf of child.children ?? []) leaf.value = 'X'
}

function injectUnsafeElements() {
  return (tree: Root): undefined => {
    const xUnsafe: Element = {
      type: 'element',
      tagName: 'x-unsafe',
      properties: {},
      children: [{ type: 'text', value: 'UNWRAPPED' }],
    }
    const script: Element = {
      type: 'element',
      tagName: 'script',
      properties: {},
      children: [{ type: 'text', value: 'PWNED' }],
    }
    tree.children.push(xUnsafe, script)
    return undefined
  }
}

const injectBlockquote =
  () =>
  (tree: Root): undefined => {
    tree.children.push({
      type: 'element',
      tagName: 'blockquote',
      properties: { dataFoo: 'bar', dataNotAllowed: 'x' },
      children: [],
    })
    return undefined
  }

describe('Markdown — rendering', () => {
  test('wraps output in the markdown slot', () => {
    expect(html(<Markdown contentTrust="untrusted">hi</Markdown>)).toBe(
      '<div data-slot="markdown"><p>hi</p></div>',
    )
  })

  test('renders GFM: table, strikethrough, task list', () => {
    const out = html(
      <Markdown contentTrust="trusted">
        {'| a | b |\n|-|-|\n| 1 | 2 |\n\n~~gone~~\n\n- [x] done\n- [ ] todo\n'}
      </Markdown>,
    )

    expect(out).toContain('<table>')
    expect(out).toContain('<del>gone</del>')
    expect(out).toContain('type="checkbox"')
    expect(out).toContain('checked=""')
    expect(out).toContain('disabled=""')
  })

  test('fences are plain pre/code', () => {
    const out = html(<Markdown contentTrust="untrusted">{'```ts\nconst a = 1\n```'}</Markdown>)

    expect(out).toContain('<pre><code class="language-ts">const a = 1\n</code></pre>')
  })

  test('renders a settled empty string', () => {
    expect(html(<Markdown contentTrust="untrusted">{''}</Markdown>)).toBe(
      '<div data-slot="markdown"></div>',
    )
  })

  test('a consumer components entry overrides a default element', () => {
    const out = html(
      <Markdown contentTrust="untrusted" components={{ h1: ({ children }) => <h2>{children}</h2> }}>
        # Title
      </Markdown>,
    )

    expect(out).toContain('<h2>Title</h2>')
  })

  test('consumer remarkPlugins run', () => {
    const out = html(
      <Markdown contentTrust="untrusted" remarkPlugins={[upper]}>
        hello
      </Markdown>,
    )

    expect(out).toContain('<p>X</p>')
  })

  test('accepts no className or style (type error)', () => {
    // @ts-expect-error — no className prop
    const withClass: MarkdownProps = { contentTrust: 'untrusted', children: 'a', className: 'x' }
    // @ts-expect-error — no style prop
    const withStyle: MarkdownProps = { contentTrust: 'untrusted', children: 'a', style: {} }

    expect(html(<Markdown {...withClass} />)).toBe(html(<Markdown {...withStyle} />))
  })
})

describe('Markdown — contentTrust discriminated union', () => {
  test('contentTrust is required', () => {
    // @ts-expect-error — contentTrust has no default
    const missing: MarkdownProps = { children: 'a' }

    expect(html(<Markdown {...missing} />)).toContain('<p>a</p>')
  })

  test('the untrusted arm refuses sanitize and rehypePlugins at the type level', () => {
    // @ts-expect-error — sanitize is trusted-only
    const a: MarkdownProps = { contentTrust: 'untrusted', children: 'a', sanitize: {} }
    // @ts-expect-error — rehypePlugins is trusted-only
    const b: MarkdownProps = { contentTrust: 'untrusted', children: 'a', rehypePlugins: [] }

    expect([a, b]).toHaveLength(2)
  })

  test('the trusted arm refuses images at the type level', () => {
    // @ts-expect-error — images is untrusted-only
    const a: MarkdownProps = { contentTrust: 'trusted', children: 'a', images: 'same-origin' }

    expect(a).toBeDefined()
  })
})

describe('Markdown — sanitize pass', () => {
  test('runs AFTER a consumer rehypePlugin: nothing it injects survives', () => {
    const out = html(
      <Markdown contentTrust="trusted" rehypePlugins={[injectUnsafeElements]}>
        paragraph
      </Markdown>,
    )

    expect(out).not.toContain('x-unsafe')
    expect(out).toContain('UNWRAPPED')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('PWNED')
  })

  test('sanitize.allowTags reaches the pipeline without destroying the defaults', () => {
    const out = html(
      <Markdown
        contentTrust="trusted"
        rehypePlugins={[injectUnsafeElements]}
        sanitize={{ allowTags: ['x-unsafe'] }}
      >
        paragraph
      </Markdown>,
    )

    expect(out).toContain('<x-unsafe>UNWRAPPED</x-unsafe>')
    expect(out).not.toContain('PWNED')
  })

  test('sanitize.allowAttrs reaches the pipeline', () => {
    const out = html(
      <Markdown
        contentTrust="trusted"
        rehypePlugins={[injectBlockquote]}
        sanitize={{ allowAttrs: { blockquote: ['data-foo'] } }}
      >
        a
      </Markdown>,
    )

    expect(out).toContain('data-foo="bar"')
    expect(out).not.toContain('data-not-allowed')
  })

  test('raw HTML in the source never becomes an element', () => {
    const out = html(
      <Markdown contentTrust="trusted">
        {'<div id="body" onclick="x()">hi</div> <script>x</script>'}
      </Markdown>,
    )

    expect(out).not.toContain('<div id')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('onclick')
  })
})

describe('Markdown — GFM footnotes survive the sanitize pass', () => {
  const DOC = 'A claim.[^1] And another.[^note]\n\n[^1]: The evidence.\n\n[^note]: More.\n'

  test('every in-document link resolves to a rendered id', () => {
    const { container } = render(<Markdown contentTrust="untrusted">{DOC}</Markdown>)
    const hashHrefs = [...container.querySelectorAll('a')]
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('#'))

    expect(hashHrefs).toHaveLength(4)
    for (const href of hashHrefs) {
      expect(container.querySelector(`[id="${href.slice(1)}"]`)).not.toBeNull()
    }
  })

  test('a footnote ref keeps the id its back-link points at (rest props forwarded)', () => {
    const { container } = render(<Markdown contentTrust="untrusted">{DOC}</Markdown>)

    expect(container.querySelector('a[id="user-content-fnref-1"]')).not.toBeNull()
    expect(container.querySelector('a[id="user-content-fnref-note"]')).not.toBeNull()
    expect(container.innerHTML).not.toContain('user-content-user-content')
  })
})

describe('Markdown — links', () => {
  test('an external https link opens in a new tab with noreferrer noopener', () => {
    const out = html(<Markdown contentTrust="untrusted">[x](https://example.com/a)</Markdown>)

    expect(out).toContain('href="https://example.com/a"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noreferrer noopener"')
  })

  test('a same-origin or fragment link has no target', () => {
    const out = html(<Markdown contentTrust="untrusted">{'[a](/p) [b](#f)'}</Markdown>)

    expect(out).toContain('href="/p"')
    expect(out).toContain('href="#f"')
    expect(out).not.toContain('target=')
  })

  test.each(['javascript:alert(1)', 'http://example.com', '//example.com'])(
    'a blocked href (%s) renders a span with the children and no destination',
    (url) => {
      const out = html(<Markdown contentTrust="untrusted">{`[label](<${url}>)`}</Markdown>)

      expect(out).toContain('<span>label</span>')
      expect(out).not.toContain('href=')
      expect(out).not.toContain('example.com')
    },
  )

  test('mailto and tel links are kept', () => {
    const out = html(
      <Markdown contentTrust="untrusted">{'[m](mailto:a@b.co) [t](tel:+1)'}</Markdown>,
    )

    expect(out).toContain('href="mailto:a@b.co"')
    expect(out).toContain('href="tel:+1"')
  })

  test('react-markdown node handle never reaches the DOM', () => {
    const out = html(
      <Markdown contentTrust="trusted">
        {'[a](/p) ![i](/i.png)\n\nA claim.[^1]\n\n[^1]: n\n'}
      </Markdown>,
    )

    expect(out).not.toContain('node=')
    expect(out).not.toContain('[object Object]')
  })
})

describe('Markdown — image trust policy', () => {
  const IMAGE_DOC = '![local](/assets/local.png)\n\n![probe](https://cdn.example/pixel.png?q=leak)'

  test('untrusted default (images none) renders no img and keeps alt as text', () => {
    const out = html(<Markdown contentTrust="untrusted">{IMAGE_DOC}</Markdown>)

    expect(out).not.toContain('<img')
    expect(out).toContain('<span>local</span>')
    expect(out).toContain('<span>probe</span>')
    expect(out).not.toContain('cdn.example')
    expect(out).not.toContain('local.png')
  })

  test("untrusted images='same-origin' allows only relative srcs", () => {
    const out = html(
      <Markdown contentTrust="untrusted" images="same-origin">
        {IMAGE_DOC}
      </Markdown>,
    )

    expect(out).toContain('src="/assets/local.png"')
    expect(out).not.toContain('cdn.example')
    expect(out).toContain('<span>probe</span>')
  })

  test('an image with an empty alt that is blocked renders nothing', () => {
    const out = html(<Markdown contentTrust="untrusted">![](https://cdn.example/q.png)</Markdown>)

    expect(out).toBe('<div data-slot="markdown"><p></p></div>')
  })

  test('trusted keeps https and same-origin images', () => {
    const out = html(<Markdown contentTrust="trusted">{IMAGE_DOC}</Markdown>)

    expect(out).toContain('src="/assets/local.png"')
    expect(out).toContain('src="https://cdn.example/pixel.png?q=leak"')
  })

  test.each(['//cdn.example/p.png', 'data:image/png;base64,AAAA', 'http://cdn.example/p.png'])(
    'trusted still blocks %s',
    (url) => {
      const out = html(<Markdown contentTrust="trusted">{`![alt](<${url}>)`}</Markdown>)

      expect(out).not.toContain('<img')
      expect(out).toContain('<span>alt</span>')
    },
  )

  test('streaming alone does NOT imply untrusted', () => {
    const out = html(
      <Markdown streaming contentTrust="trusted">
        {IMAGE_DOC}
      </Markdown>,
    )

    expect(out).toContain('cdn.example')
  })
})

describe('Markdown — an unrecognised or prototype-key contentTrust fails closed', () => {
  const IMAGE_DOC = '![local](/assets/local.png)\n\n![probe](https://cdn.example/pixel.png?q=leak)'

  for (const hostile of ['nonsense', 'toString', 'constructor', '__proto__', '', 'Trusted']) {
    test(`contentTrust=${JSON.stringify(hostile)}`, () => {
      const Loose = Markdown as unknown as React.ComponentType<Record<string, unknown>>
      const out = html(
        <Loose
          contentTrust={hostile}
          images="same-origin"
          sanitize={{ allowTags: ['img'], allowAttrs: { img: ['src'] } }}
          rehypePlugins={[injectUnsafeElements]}
        >
          {IMAGE_DOC}
        </Loose>,
      )

      expect(out).not.toContain('cdn.example')
      expect(out).not.toContain('x-unsafe')
      expect(out).not.toContain('<script')
      expect(out).toContain('src="/assets/local.png"')
    })
  }

  test.each([undefined, null, 0, {}])(
    'contentTrust=%p renders without crashing, no remote image',
    (value) => {
      const Loose = Markdown as unknown as React.ComponentType<Record<string, unknown>>
      const out = html(<Loose contentTrust={value}>{IMAGE_DOC}</Loose>)

      expect(out).not.toContain('<img')
      expect(out).not.toContain('cdn.example')
    },
  )
})
