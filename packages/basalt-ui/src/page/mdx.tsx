import { Children, isValidElement } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { headingSlug } from '../core/slug'
import { safeUrl } from '../core/url'
import { Alert } from '../ui/alert'
import { Kbd } from '../ui/kbd'
import { Tabs as TabsRoot, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Callout } from './callout'
import type { MDXComponents } from './contract'

/** Vertical rhythm for a block that is not a prose element, so it sits like its siblings. */
const BLOCK = 'in-[.vx-prose]:mt-(--vx-rhythm-2)'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

function heading(Tag: 'h2' | 'h3' | 'h4') {
  return function Heading({ id, children, ...rest }: ComponentProps<'h2'>): ReactElement {
    const slug = id ?? headingSlug(textOf(children))
    return (
      <Tag {...rest} id={slug}>
        <a
          href={`#${slug}`}
          className="text-inherit no-underline hover:underline focus-ring rounded-sm"
        >
          {children}
        </a>
      </Tag>
    )
  }
}

/** A link through the url policy: a blocked `href` (`//h`, `javascript:`) renders no `href`. */
function A({ href, children, ...rest }: ComponentProps<'a'>): ReactElement {
  const safe = href === undefined ? null : safeUrl(href, 'trusted')
  return (
    <a {...rest} {...(safe !== null && { href: safe })}>
      {children}
    </a>
  )
}

/** A table that scrolls sideways inside its own box, so a wide one never widens the page. */
function Table(props: ComponentProps<'table'>): ReactElement {
  return (
    <div className={cn(BLOCK, 'overflow-x-auto')}>
      <table {...props} className={cn('m-0', props.className)} />
    </div>
  )
}

function Blockquote({ children }: { children?: ReactNode }): ReactElement {
  return <Alert className={BLOCK}>{children}</Alert>
}

function Steps({ children }: { children?: ReactNode }): ReactElement {
  return <ol className={BLOCK}>{children}</ol>
}

function Step({ title, children }: { title: string; children?: ReactNode }): ReactElement {
  return (
    <li>
      <strong className="block">{title}</strong>
      {children}
    </li>
  )
}

type TabProps = { value: string; label: string; children?: ReactNode }

/** One panel; `Tabs` reads its `value` and `label` to build the trigger row. */
function Tab({ value, children }: TabProps): ReactElement {
  return <TabsContent value={value}>{children}</TabsContent>
}

function Tabs({
  defaultValue,
  children,
}: {
  defaultValue?: string
  children?: ReactNode
}): ReactElement {
  const tabs = Children.toArray(children).filter(isValidElement) as ReactElement<TabProps>[]
  const first = tabs[0]?.props.value
  return (
    <TabsRoot defaultValue={defaultValue ?? first} className={BLOCK}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.props.value} value={tab.props.value}>
            {tab.props.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </TabsRoot>
  )
}

function Figure({ caption, children }: { caption?: string; children?: ReactNode }): ReactElement {
  return (
    <figure>
      {children}
      {caption !== undefined && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/**
 * The fixed MDX component map: anchored `h2`-`h4`, `a` through the url policy, `table`,
 * `blockquote` on `Alert`, and `Callout`, `Steps`, `Step`, `Tabs`, `Tab`, `Figure` and `Kbd` for
 * the tags an author writes. Pass it as the `components` of the compiled module. It needs no
 * markdown peer and no compiler; the page is wrapped in `Prose`. A heading id the compiler already
 * set (rehype-slug) is kept; otherwise it is the slug of the heading text, so two identical
 * headings need distinct ids from the compiler. `pre` is not in the map: the recipe adapts it.
 *
 * @useWhen authored MDX is compiled by the app's toolchain and should render in the basalt look
 * @neverWhen the text came from a model (MDX is code; use `Markdown` with `contentTrust="untrusted"`)
 *
 * @example
 * <Prose><Content components={mdxComponents} /></Prose>
 */
export const mdxComponents: MDXComponents = {
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  a: A,
  table: Table,
  blockquote: Blockquote,
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Figure,
  Kbd,
}
