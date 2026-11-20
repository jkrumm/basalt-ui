/**
 * The `basalt-ui/static` contract, one test per clause:
 * (a) every part is a pure function of its props: called outside a React render, where any hook
 *     throws, it expands to host elements, and its markup carries no script;
 * (b) no visible word and no accessible name is baked in: with every label a sentinel, nothing
 *     with a letter is left once the sentinels are removed;
 * (d) the prose sheet styles raw Markdown output by element.
 * The script budget and the scheme parity of `siteScript()` close the file. (c), logical
 * properties, is the `logical-properties` lint rule's test over this directory.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { Fragment, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { setScheme, SCHEME_KEY } from '../core/scheme'
import { themeScript } from '../css/theme-script'
import {
  SiteArticle,
  SiteCallout,
  SiteCodeBlock,
  SiteDataTable,
  SiteField,
  SiteForm,
  SitePager,
  Prose,
  SiteFooter,
  SiteHeader,
  siteMdxComponents,
  SiteSubmit,
  SiteTab,
  SiteTabs,
  ThemeSwitch,
} from './index'
import { siteScript } from './site-script'
import { SiteToc } from './toc'

const S = (key: string): string => `«${key}»`

/** Calls every function component directly, outside a render: a hook has no dispatcher and throws. */
function expand(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(expand)
  if (!isValidElement(node)) return node
  const { type } = node
  const props = node.props as Record<string, unknown> & { children?: ReactNode }
  if (typeof type === 'function') return expand((type as (p: unknown) => ReactNode)(props))
  if ((type as unknown) === Fragment) return expand(props.children)
  const children = props.children === undefined ? undefined : expand(props.children)
  return { ...node, props: { ...props, children } } as ReactElement
}

const switchProps = {
  label: S('scheme'),
  labels: { light: S('light'), dark: S('dark'), auto: S('auto') },
}
const pager = (
  <SitePager
    label={S('pages')}
    prevLabel={S('prev')}
    nextLabel={S('next')}
    prev={{ href: '/a', label: S('prev-page') }}
    next={{ href: '/b', label: S('next-page') }}
  />
)
const mdx = siteMdxComponents({ copyLabel: S('copy'), copiedLabel: S('copied') })
const Mdx = (name: string, props: Record<string, unknown>): ReactElement => {
  const Part = mdx[name] as unknown as (p: Record<string, unknown>) => ReactElement
  return <Part {...props} />
}

const PARTS: Record<string, ReactElement> = {
  Prose: (
    <Prose>
      <p>{S('body')}</p>
    </Prose>
  ),
  SiteHeader: (
    <SiteHeader
      brand={<a href="/">{S('brand')}</a>}
      links={[{ href: '/docs', label: S('link'), current: true }]}
      navLabel={S('nav')}
      menuLabel={S('menu')}
      actions={<ThemeSwitch {...switchProps} />}
    />
  ),
  SiteFooter: (
    <SiteFooter
      brand={<p>{S('brand')}</p>}
      groups={[{ title: S('group'), links: [{ href: '/x', label: S('footer-link') }] }]}
      label={S('footer')}
    >
      {S('fine-print')}
    </SiteFooter>
  ),
  ThemeSwitch: <ThemeSwitch {...switchProps} />,
  'SiteCallout with title': (
    <SiteCallout tone="warn" title={S('title')}>
      {S('note')}
    </SiteCallout>
  ),
  'SiteCallout with tone label': (
    <SiteCallout tone="good" toneLabel={S('tip')}>
      {S('note')}
    </SiteCallout>
  ),
  SiteCodeBlock: (
    <SiteCodeBlock copyLabel={S('copy')} copiedLabel={S('copied')} caption={S('file')}>
      <pre>
        <code>{S('code')}</code>
      </pre>
    </SiteCodeBlock>
  ),
  SiteToc: (
    <SiteToc
      label={S('toc')}
      entries={[
        { id: 'a', label: S('entry-a'), level: 2 },
        { id: 'b', label: S('entry-b'), level: 3 },
      ]}
    />
  ),
  SitePager: pager,
  SiteArticle: (
    <SiteArticle
      title={S('title')}
      description={S('description')}
      meta={S('meta')}
      toc={[{ id: 'a', label: S('entry'), level: 2 }]}
      tocLabel={S('toc')}
      nav={<a href="/n">{S('nav-link')}</a>}
      navLabel={S('docs')}
      footer={pager}
    >
      <p>{S('body')}</p>
    </SiteArticle>
  ),
  'mdx h2': Mdx('h2', { children: S('heading') }),
  'mdx a': Mdx('a', { href: 'https://example.com', children: S('link') }),
  'mdx table': Mdx('table', {
    children: (
      <tbody>
        <tr>
          <td>{S('cell')}</td>
        </tr>
      </tbody>
    ),
  }),
  'mdx pre': Mdx('pre', { children: <code>{S('code')}</code> }),
  'mdx Steps': Mdx('Steps', { children: Mdx('Step', { title: S('step'), children: S('text') }) }),
  'mdx Figure': Mdx('Figure', { caption: S('caption'), children: S('figure') }),
  SiteTabs: (
    <SiteTabs label={S('tabs')} tabs={[S('one'), S('two')]}>
      <SiteTab label={S('one')}>{S('first')}</SiteTab>
      <SiteTab label={S('two')}>{S('second')}</SiteTab>
    </SiteTabs>
  ),
  SiteForm: (
    <SiteForm action="/subscribe">
      <SiteField
        label={S('email')}
        name="email"
        type="email"
        autoComplete="email"
        description={S('hint')}
        placeholder={S('placeholder')}
        required
      />
      <SiteField label={S('message')} name="message" type="textarea" autoComplete="off" />
      <SiteSubmit>{S('send')}</SiteSubmit>
    </SiteForm>
  ),
  SiteDataTable: (
    <SiteDataTable
      label={S('table')}
      columns={[
        { key: 'name', label: S('name') },
        { key: 'size', label: S('size'), kind: 'number' },
      ]}
      rows={[{ name: S('row'), size: 71500 }]}
    />
  ),
  'mdx Tabs': Mdx('Tabs', {
    label: S('tabs'),
    tabs: [S('one')],
    children: Mdx('Tab', { label: S('one'), children: S('first') }),
  }),
}

const markup = (node: ReactElement): string => renderToStaticMarkup(<>{expand(node)}</>)

/** Every visible text node plus every accessible-name and announced-label attribute. */
function words(html: string): string[] {
  const host = document.createElement('div')
  host.innerHTML = html
  const out: string[] = []
  const walk = (n: Node): void => {
    if (n.nodeType === 3) out.push(n.textContent ?? '')
    for (const c of Array.from(n.childNodes)) walk(c)
  }
  walk(host)
  for (const el of Array.from(host.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const named =
        /^(aria-label|aria-description|aria-roledescription|title|alt|placeholder|data-copied-label)$/
      if (named.test(attr.name)) out.push(attr.value)
    }
  }
  return out
}

describe('basalt-ui/static: (a) static, no hook, no script', () => {
  for (const [name, node] of Object.entries(PARTS)) {
    test(`${name} renders as a pure function of its props`, () => {
      const html = markup(node)
      expect(html.length).toBeGreaterThan(0)
      expect(html).not.toContain('<script')
    })
  }
})

describe('basalt-ui/static: (b) no baked string', () => {
  for (const [name, node] of Object.entries(PARTS)) {
    test(`${name} shows and announces only the words it was given`, () => {
      const left = words(markup(node))
        .map((w) => w.replaceAll(/«[^»]*»/g, ''))
        .filter((w) => /\p{L}/u.test(w))
      expect(left).toEqual([])
    })
  }
})

describe('basalt-ui/static: (d) prose styles raw Markdown by element', () => {
  const css = readFileSync(join(import.meta.dir, '../css/prose.css'), 'utf8')
  for (const el of [
    'p',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'table',
    'th',
    'td',
    'h2',
    'h3',
    'h4',
    'a',
    'img',
    'hr',
    'figure',
    'figcaption',
  ]) {
    test(`.basalt-prose styles a bare <${el}>`, () => {
      const selector = new RegExp(`\\.basalt-prose[^{]*[\\s(,]${el}[\\s),:]`)
      expect(css).toMatch(selector)
    })
  }
})

describe('siteScript', () => {
  test('stays inside the 2 kB gzip budget together with themeScript', () => {
    const bytes = gzipSync(`${themeScript()};${siteScript()}`).byteLength
    expect(bytes).toBeLessThanOrEqual(2048)
  })

  const html = markup(
    <>
      <ThemeSwitch {...switchProps} />
      <SiteCodeBlock copyLabel="copy" copiedLabel="Copied">
        <pre>
          <code>bun add basalt-ui</code>
        </pre>
      </SiteCodeBlock>
    </>,
  )
  const copied: string[] = []

  beforeAll(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) },
    })
    new Function(siteScript())()
  })

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.body.innerHTML = html
  })

  // The DOM is shared with every later test file in this process: leave it as it was found.
  afterEach(() => {
    document.body.innerHTML = ''
  })

  afterAll(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    ;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
      'about:blank',
    )
  })

  const click = (selector: string): void => {
    document
      .querySelector<HTMLElement>(selector)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  for (const scheme of ['light', 'dark', 'auto'] as const) {
    test(`a ${scheme} click leaves the page as setScheme('${scheme}') does`, () => {
      click(`[data-basalt-scheme="${scheme}"]`)
      const viaScript = [
        document.documentElement.getAttribute('data-theme'),
        localStorage.getItem(SCHEME_KEY),
      ]
      localStorage.clear()
      document.documentElement.removeAttribute('data-theme')
      setScheme(scheme)
      expect(viaScript).toEqual([
        document.documentElement.getAttribute('data-theme'),
        localStorage.getItem(SCHEME_KEY),
      ])
      const pressed = document
        .querySelector(`[data-basalt-scheme="${scheme}"]`)
        ?.getAttribute('aria-pressed')
      expect(pressed).toBe('true')
    })
  }

  test('with scheme options, a click writes what themeScript reads back on the next load', () => {
    // happy-dom drops path-scoped cookies on about:blank
    ;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
      'http://localhost/',
    )
    const options = { key: 'site:scheme', cookie: 'site-scheme' }
    new Function(siteScript(options))()
    click('[data-basalt-scheme="dark"]')
    expect(localStorage.getItem('site:scheme')).toBe('dark')
    expect(document.cookie).toContain('site-scheme=dark')
    document.documentElement.removeAttribute('data-theme')
    new Function(themeScript(options))()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  test('a copy click copies the block and announces the given word', async () => {
    click('[data-basalt-copy]')
    await Promise.resolve()
    await Promise.resolve()
    expect(copied.at(-1)).toContain('bun add basalt-ui')
    expect(document.querySelector('[data-basalt-copy]')?.hasAttribute('data-copied')).toBe(true)
    expect(document.querySelector('[data-basalt-copy-status]')?.textContent).toBe('Copied')
  })
})
