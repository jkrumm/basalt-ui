import type { ComponentProps, ComponentType, ReactElement, ReactNode } from 'react'
import { isValidElement } from 'react'
import { cn } from '../core/cn'
import { headingSlug } from '../core/slug'
import { safeUrl } from '../core/url'
import { SiteCallout } from './callout'
import { SiteCodeBlock } from './code-block'
import { SiteField, SiteForm, SiteSubmit } from './form'
import { SiteTab, SiteTabs } from './tabs'

/** The words the map's parts show or announce; your catalogue's strings. */
export type SiteMdxLabels = {
  /** The code blocks' copy button name ("Copy code"). */
  copyLabel: string
  /** Announced after a copy ("Copied"). */
  copiedLabel: string
}

/** Vertical rhythm for a block that is not a prose element, so it sits like its siblings. */
const BLOCK = 'in-[.basalt-prose]:mt-(--basalt-rhythm-2)'

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
          className="focus-ring rounded-sm text-inherit no-underline hover:underline"
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

function Figure({ caption, children }: { caption?: string; children?: ReactNode }): ReactElement {
  return (
    <figure>
      {children}
      {caption !== undefined && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/**
 * The MDX component map for static pages: anchored `h2`-`h4`, `a` through the url policy, a
 * scrolling `table`, every fenced block in a `SiteCodeBlock` with a copy button, and `SiteCallout`,
 * `Steps`, `Step`, `Figure`, `Tabs` and `Tab`, and `Form`, `Field` and `SubmitButton` for the tags an
 * author writes. Nothing in it hydrates; the copy button and the tabs need `siteScript()`. A sortable
 * table and a chart are islands: add `basalt-ui/astro/mdx/DataTable.astro` and `Chart.astro` as the
 * `DataTable` and `Chart` entries. Pass the result as the compiled module's `components` inside
 * `Prose`. The words come from `labels`; none is baked in.
 *
 * @useWhen authored MDX renders on a content page that ships no client JavaScript
 * @neverWhen the MDX needs parts that share state or a provider (use `mdxComponents` from `basalt-ui/page` in an app)
 *
 * @example
 * const components = siteMdxComponents({ copyLabel: 'Copy code', copiedLabel: 'Copied' })
 * <Prose><Content components={components} /></Prose>
 */
export function siteMdxComponents(
  labels: SiteMdxLabels,
): Readonly<Record<string, ComponentType<never>>> {
  function Pre(props: ComponentProps<'pre'>): ReactElement {
    return (
      <SiteCodeBlock copyLabel={labels.copyLabel} copiedLabel={labels.copiedLabel}>
        <pre {...props} />
      </SiteCodeBlock>
    )
  }
  return {
    h2: heading('h2'),
    h3: heading('h3'),
    h4: heading('h4'),
    a: A,
    table: Table,
    pre: Pre,
    SiteCallout,
    Steps,
    Step,
    Figure,
    Tabs: SiteTabs,
    Tab: SiteTab,
    Form: SiteForm,
    Field: SiteField,
    SubmitButton: SiteSubmit,
  }
}
