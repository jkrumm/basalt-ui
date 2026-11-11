/**
 * Markdown — one react-markdown pipeline with an explicit trust arm. Every import is static: a
 * missing peer is an install error, never a degrade, so the first paint (server, client, hydrate)
 * is already the rendered, sanitized tree.
 *
 * `contentTrust` is REQUIRED and independent of `streaming` (a finished agent message is settled
 * but still model-generated). The `untrusted` arm accepts no `sanitize` and no `rehypePlugins`, and
 * at runtime ONLY the exact string `'trusted'` selects the other arm — a plain-JS caller, an `as`
 * cast or a prototype key (`'toString'`) all fall back to `untrusted` and have the trusted-only
 * props ignored.
 *
 * Pipeline: remark-gfm + consumer remark plugins, (trusted) consumer rehype plugins, then
 * `rehype-sanitize` LAST so nothing a plugin injects outruns it. `urlTransform` applies the parser
 * policy from `core/url` to links and images alike.
 *
 * Streaming: the text is split into blocks; every block but the last is a `memo`ised component
 * keyed by position, so a new token re-renders only the tail, which is repaired by `remend` first.
 * `pipeline` is memoised on its inputs, which is what keeps settled blocks referentially stable.
 */
import { memo, useMemo } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components, ExtraProps, Options, UrlTransform } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remend from 'remend'
import { safeRelativeUrl, safeUrl } from '../core/url'
import type { UrlTrust } from '../core/url'
import { SlugTracker } from '../core/slug'
import { blockSplit } from './block-split'
import type { FenceRenderers } from './contract'
import { FenceSettled, createFencePre } from './fences'
import { HeadingSlugs, createHeadingComponents } from './headings'
import { createSanitizeSchema } from './sanitize'
import type { SanitizeAdditions } from './sanitize'

type RemarkPlugins = NonNullable<Options['remarkPlugins']>
type RehypePlugins = NonNullable<Options['rehypePlugins']>
type PluginList = RemarkPlugins & RehypePlugins

type MarkdownBase = {
  children: string
  streaming?: boolean
  fenceRenderers?: FenceRenderers
  components?: Components
  remarkPlugins?: RemarkPlugins
}

export type MarkdownProps = MarkdownBase &
  (
    | {
        contentTrust: 'untrusted'
        /** `'none'` (default) renders an image's alt text only; `'same-origin'` allows relative srcs. */
        images?: 'none' | 'same-origin'
        sanitize?: never
        rehypePlugins?: never
      }
    | {
        contentTrust: 'trusted'
        sanitize?: SanitizeAdditions
        rehypePlugins?: PluginList
      }
  )

type LinkProps = ComponentProps<'a'> & ExtraProps
type ImgProps = ComponentProps<'img'> & ExtraProps

const EXTERNAL_HREF = /^https:\/\//i

// `rest` carries what the sanitizer vetted (footnote `id`s a back-link targets); `node` is
// react-markdown's hast handle and must never reach the DOM.
function LinkRenderer({ href, children, node: _node, ...rest }: LinkProps) {
  if (href === undefined || href === '') return <span {...rest}>{children}</span>
  return (
    <a
      href={href}
      {...rest}
      {...(EXTERNAL_HREF.test(href) && { target: '_blank', rel: 'noreferrer noopener' })}
    >
      {children}
    </a>
  )
}

function AltText({ alt }: ImgProps) {
  return alt ? <span>{alt}</span> : null
}

function ImageRenderer({ src, alt, node: _node, ...rest }: ImgProps) {
  if (typeof src !== 'string' || src === '') return <AltText alt={alt} />
  return <img src={src} alt={alt ?? ''} loading="lazy" {...rest} />
}

type Pipeline = {
  remarkPlugins: RemarkPlugins
  rehypePlugins: RehypePlugins
  components: Components
  urlTransform: UrlTransform
}

function buildUrlTransform(trust: UrlTrust, images: 'none' | 'same-origin'): UrlTransform {
  return (url, key) => {
    if (key !== 'src') return safeUrl(url, trust)
    if (trust === 'trusted') return safeUrl(url, trust)
    return images === 'same-origin' ? safeRelativeUrl(url, trust) : null
  }
}

const UNTRUSTED_SCHEMA = createSanitizeSchema()
const HEADINGS = createHeadingComponents()

function usePipeline(props: MarkdownProps): Pipeline {
  const { components, remarkPlugins, fenceRenderers } = props
  const trusted = props.contentTrust === 'trusted'
  const images = !trusted && props.images === 'same-origin' ? 'same-origin' : 'none'
  const sanitize = trusted ? props.sanitize : undefined
  const rehypePlugins = trusted ? props.rehypePlugins : undefined

  return useMemo(
    () => ({
      remarkPlugins: [remarkGfm, ...(remarkPlugins ?? [])],
      rehypePlugins: [
        ...(rehypePlugins ?? []),
        [rehypeSanitize, sanitize ? createSanitizeSchema(sanitize) : UNTRUSTED_SCHEMA],
      ] as RehypePlugins,
      components: {
        a: LinkRenderer,
        img: trusted || images === 'same-origin' ? ImageRenderer : AltText,
        ...HEADINGS,
        pre: createFencePre(fenceRenderers),
        ...components,
      },
      urlTransform: buildUrlTransform(trusted ? 'trusted' : 'untrusted', images),
    }),
    [trusted, images, sanitize, rehypePlugins, remarkPlugins, components, fenceRenderers],
  )
}

// `settled` is false only for the tail of a streaming message: fences there show as code. Each
// rendered block mints its own slug tracker, so heading ids dedupe within a block (a streamed
// message repeating a heading text across blocks repeats the id; the cost of a stable settled block).
function Block({
  text,
  pipeline,
  settled = true,
}: {
  text: string
  pipeline: Pipeline
  settled?: boolean
}) {
  return (
    <HeadingSlugs value={new SlugTracker()}>
      <FenceSettled value={settled}>
        <ReactMarkdown
          remarkPlugins={pipeline.remarkPlugins}
          rehypePlugins={pipeline.rehypePlugins}
          components={pipeline.components}
          urlTransform={pipeline.urlTransform}
        >
          {text}
        </ReactMarkdown>
      </FenceSettled>
    </HeadingSlugs>
  )
}

const SettledBlock = memo(Block)

function StreamingBody({ text, pipeline }: { text: string; pipeline: Pipeline }): ReactNode {
  const blocks = blockSplit(text)
  const lastIndex = blocks.length - 1
  // Block positions are stable during a stream (only the tail is replaced in place), so the index
  // is a safe key.
  return blocks.map((block, index) =>
    index === lastIndex ? (
      <Block key={index} text={remend(block)} pipeline={pipeline} settled={false} />
    ) : (
      <SettledBlock key={index} text={block} pipeline={pipeline} />
    ),
  )
}

export function Markdown(props: MarkdownProps) {
  const pipeline = usePipeline(props)
  return (
    <div data-slot="markdown">
      {props.streaming ? (
        <StreamingBody text={props.children} pipeline={pipeline} />
      ) : (
        <Block text={props.children} pipeline={pipeline} />
      )}
    </div>
  )
}
