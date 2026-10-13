/**
 * URL hardening for `Markdown` — an `allowedLinkPrefixes`/`allowedImagePrefixes` allowlist plus
 * optional `defaultOrigin` resolution for relative URLs (docs/CONTENT-SPEC.md §2 decision 2 / §6).
 * Always on in `streaming` mode; on by default otherwise too (`Markdown`'s `a`/`img` renderers
 * treat a `href`/`src` that `urlTransform` dropped as "render without a link/image").
 *
 * Not part of the public surface — `./markdown` is the only consumer. MDX content is authored,
 * not hardened (docs/CONTENT-SPEC.md §3) — `./mdx` does not use this module.
 */
import type { UrlTransform } from 'react-markdown'

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

// remend's repair sentinels (`[text](streamdown:incomplete-link)`, `![alt](streamdown:incomplete-image)`)
// are placeholders for a half-streamed URL, never a destination. Rejected before the allowlist so a
// permissive consumer prefix (`''`, `'streamdown:'`) can't turn one into a real `href`/`img src`.
const INCOMPLETE_SENTINEL_RE = /^streamdown:incomplete-(?:link|image)$/i

function isAllowedUrl(url: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => url.startsWith(prefix))
}

function resolveRelativeUrl(url: string, defaultOrigin: string | undefined): string {
  if (defaultOrigin === undefined) return url
  if (url.startsWith('#') || url.startsWith('//') || SCHEME_RE.test(url)) return url
  try {
    return new URL(url, defaultOrigin).toString()
  } catch {
    return url
  }
}

export type CreateUrlTransformOptions = {
  readonly allowedLinkPrefixes: readonly string[]
  readonly allowedImagePrefixes: readonly string[]
  readonly defaultOrigin?: string
}

/**
 * Builds the `urlTransform` passed to `<ReactMarkdown>`. Disallowed URLs (including remend's
 * `streamdown:incomplete-link` / `streamdown:incomplete-image` sentinels, which no allowlist can admit) resolve to
 * `null`, which react-markdown renders as an `href`/`src`-less element; the `a`/`img` component
 * overrides in `./markdown` turn that into an unlinked span / dropped image.
 */
export function createUrlTransform(opts: CreateUrlTransformOptions): UrlTransform {
  return (url, key) => {
    if (INCOMPLETE_SENTINEL_RE.test(url)) return null
    const prefixes = key === 'src' ? opts.allowedImagePrefixes : opts.allowedLinkPrefixes
    if (!isAllowedUrl(url, prefixes)) return null
    return resolveRelativeUrl(url, opts.defaultOrigin)
  }
}
