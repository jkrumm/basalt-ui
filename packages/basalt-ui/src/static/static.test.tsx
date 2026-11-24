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
  SiteBento,
  SiteCallToAction,
  SiteComparison,
  SiteFeature,
  SiteFooter,
  SiteHeader,
  SiteHero,
  siteMdxComponents,
  SiteSubmit,
  SiteTab,
  SiteTabs,
  SiteQuestionList,
  SiteChangelog,
  SiteNav,
  SitePostList,
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
  'SiteHeader with menus': (
    <SiteHeader
      brand={<a href="/">{S('brand')}</a>}
      links={[
        { href: '/docs', label: S('link') },
        {
          label: S('menu-item'),
          menu: [
            {
              title: S('section'),
              entries: [
                {
                  href: '/tile',
                  label: S('tile'),
                  description: S('line'),
                  image: { src: '/tile.png', alt: S('picture') },
                },
                { href: '/row', label: S('row'), description: S('row-line') },
              ],
            },
          ],
        },
      ]}
      navLabel={S('nav')}
      menuLabel={S('menu')}
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
  SiteHero: (
    <SiteHero
      eyebrow={S('eyebrow')}
      title={S('title')}
      description={S('description')}
      actions={[
        { href: '/start', label: S('start'), primary: true },
        { href: '/code', label: S('code') },
      ]}
      media={<p>{S('media')}</p>}
    >
      {S('install')}
    </SiteHero>
  ),
  SiteBento: (
    <SiteBento title={S('title')} description={S('description')}>
      <SiteFeature title={S('feature')} description={S('text')} span="wide">
        <p>{S('body')}</p>
      </SiteFeature>
      <SiteFeature title={S('feature-2')} span="tall" />
    </SiteBento>
  ),
  SiteComparison: (
    <SiteComparison
      title={S('title')}
      description={S('description')}
      caption={S('caption')}
      rowHeader={S('row-header')}
      yesLabel={S('yes')}
      noLabel={S('no')}
      columns={[
        { key: 'a', label: S('ours'), ours: true },
        { key: 'b', label: S('theirs') },
      ]}
      rows={[
        { label: S('trait'), values: { a: true, b: false } },
        { label: S('text-trait'), values: { a: S('value') } },
      ]}
      footnote={S('sources')}
    />
  ),
  SiteQuestionList: (
    <SiteQuestionList
      title={S('title')}
      description={S('description')}
      questions={[
        { id: 'q1', question: S('question'), answer: S('answer') },
        { question: S('question-2'), answer: [S('para-1'), S('para-2')] },
      ]}
    />
  ),
  SiteCallToAction: (
    <SiteCallToAction
      title={S('title')}
      description={S('description')}
      actions={[{ href: '/start', label: S('start'), primary: true }]}
    />
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
  SiteNav: (
    <SiteNav
      groups={[
        {
          title: S('group'),
          links: [
            { href: '/a', label: S('first'), current: true },
            { label: S('parent'), items: [{ href: '/b', label: S('child') }] },
          ],
        },
      ]}
    />
  ),
  SitePostList: (
    <SitePostList
      label={S('posts')}
      posts={[
        {
          href: '/a',
          title: S('title'),
          description: S('line'),
          date: '2026-11-20',
          meta: S('byline'),
          tags: [S('tag')],
        },
      ]}
    />
  ),
  SiteChangelog: (
    <SiteChangelog
      releases={[
        {
          version: '3.1.0',
          date: '2026-12-01',
          href: '/tag',
          summary: S('summary'),
          groups: [{ label: S('added'), items: [S('item')] }],
        },
      ]}
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
    // A day is formatted by Intl in the page's locale: data, not a word the part brings.
    if ((n as Element).tagName === 'TIME') return
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

describe('basalt-ui/static: site header menus', () => {
  const html = markup(PARTS['SiteHeader with menus'] as ReactElement)
  const host = document.createElement('div')
  host.innerHTML = html

  test('a menu is a popover opened by a button, hover included, with no script', () => {
    const trigger = host.querySelector('button[data-basalt-top]')
    const id = trigger?.getAttribute('popovertarget')
    expect(id).toBeTruthy()
    expect(trigger?.getAttribute('interestfor')).toBe(id)
    const panel = host.querySelector(`[id="${id}"]`)
    expect(panel?.getAttribute('popover')).toBe('auto')
    expect(panel?.getAttribute('role')).toBe('group')
    expect(panel?.getAttribute('aria-label')).toBe('«menu-item»')
    expect(html).not.toContain('<script')
  })

  test('every id on the page is unique', () => {
    const ids = [...host.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('an entry with an image is a tile with its picture; one without is a row', () => {
    const panel = host.querySelector('[data-slot="site-menu-panel"]')
    const imgs = panel?.querySelectorAll('img') ?? []
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.getAttribute('alt')).toBe('«picture»')
    expect(panel?.querySelectorAll('a')).toHaveLength(2)
  })

  test('the phone sheet repeats the menu as a labelled section of rows', () => {
    const sheet = host.querySelector('[data-slot="site-menu"]')
    const headings = [...(sheet?.querySelectorAll('p[id]') ?? [])].map((p) => p.textContent)
    expect(headings).toEqual(['«menu-item»', '«section»'])
    const list = sheet?.querySelector('ul[aria-labelledby]')
    expect(
      sheet?.querySelector(`[id="${list?.getAttribute('aria-labelledby')}"]`)?.textContent,
    ).toBe('«section»')
    expect(list?.querySelectorAll('a')).toHaveLength(2)
    expect(sheet?.querySelectorAll('[popover]')).toHaveLength(0)
  })

  test('the sheet is full height only where a menu needs it', () => {
    const links = markup(
      <SiteHeader links={[{ href: '/a', label: S('a') }]} navLabel="n" menuLabel="m" />,
    )
    expect(links).toContain('max-h-[calc(100dvh-3.5rem)]')
    expect(html).toContain('h-[calc(100dvh-3.5rem)]')
  })
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

describe('SiteQuestionList: the questions are data', () => {
  test('one native details per question, its answer as paragraphs, no script', () => {
    const host = document.createElement('div')
    host.innerHTML = markup(
      <SiteQuestionList
        questions={[
          { id: 'free', question: 'Q1', answer: 'A1' },
          { question: 'Q2', answer: ['A2a', 'A2b'] },
        ]}
      />,
    )
    const items = Array.from(host.querySelectorAll('details'))
    expect(items.map((d) => d.querySelector('summary')?.textContent)).toEqual(['Q1', 'Q2'])
    expect(items[0]?.id).toBe('free')
    expect(Array.from(items[1]?.querySelectorAll('p') ?? []).map((p) => p.textContent)).toEqual([
      'A2a',
      'A2b',
    ])
  })
})

describe('SiteComparison: a mark announces its word', () => {
  test('true and false cells carry the yes and no labels, a missing key is empty', () => {
    const host = document.createElement('div')
    host.innerHTML = markup(
      <SiteComparison
        caption="c"
        rowHeader="r"
        yesLabel="Y"
        noLabel="N"
        columns={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
          { key: 'c', label: 'C' },
        ]}
        rows={[{ label: 'row', values: { a: true, b: false } }]}
      />,
    )
    const cells = Array.from(host.querySelectorAll('tbody td')).map((td) => td.textContent)
    expect(cells).toEqual(['Y', 'N', ''])
    expect(host.querySelectorAll('tbody th[scope=row]').length).toBe(1)
  })
})
