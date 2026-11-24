/**
 * The tags `SiteHead.astro` writes, computed apart from Astro so a test can read them: the title,
 * the canonical URL, Open Graph, the Twitter card and, for an article, its JSON-LD.
 */

/** One author of an article: a name, or a name with the page that speaks for them. */
export type SiteHeadAuthor = string | { name: string; url?: string }

export type SiteHeadProps = {
  /** The page title: the `<title>`, `og:title` and the article headline. Your words, suffix included. */
  title: string
  /** One or two sentences: the meta description, `og:description` and the article's `description`. */
  description: string
  /** An article's headline in its JSON-LD, when it differs from the title (a title carries the site's suffix). Default `title`. */
  headline?: string
  /** The page's canonical URL: absolute, or a path resolved against `site`. Default: this page on `site`; none without a `site`. */
  canonical?: string | URL
  /** The social picture: absolute, or a path resolved against `site`. */
  image?: string | { src: string; alt?: string }
  /** `'article'` adds the article tags and the JSON-LD block. Default `'website'`. */
  type?: 'website' | 'article'
  /** The site's name (`og:site_name`). */
  siteName?: string
  /** The page's locale in Open Graph form (`en_US`). */
  locale?: string
  /** The date an article first appeared (a `Date` or an ISO string). */
  published?: Date | string
  /** The date an article last changed meaningfully. */
  modified?: Date | string
  /** Who wrote the article. */
  authors?: readonly SiteHeadAuthor[]
  /** The article's tags or topics. */
  tags?: readonly string[]
  /** Keep the page out of search results. */
  noindex?: boolean
  /** The Twitter card. Default `'summary_large_image'` with an `image`, else `'summary'`. */
  card?: 'summary' | 'summary_large_image'
  /** The site's Twitter handle (`@name`). */
  twitterSite?: string
}

/** Where the page lives: Astro's `Astro.site` and `Astro.url.pathname`. */
export type SiteHeadPage = { site?: URL | undefined; pathname: string }

/** One `<meta>` the head writes: `name` or `property`, and its content. */
export type SiteHeadMeta = { name?: string; property?: string; content: string }

export type SiteHeadTags = {
  title: string
  canonical: string | null
  meta: SiteHeadMeta[]
  /** The article's schema.org object, or `null` for a page that is not an article. */
  jsonLd: Record<string, unknown> | null
}

function resolveUrl(value: string | URL, site: URL | undefined): string | null {
  if (value instanceof URL) return value.href
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value
  return site === undefined ? null : new URL(value, site).href
}

const iso = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value)

const authorName = (a: SiteHeadAuthor): string => (typeof a === 'string' ? a : a.name)

/** The tags a page's head carries, from its props and where it lives. */
export function siteHeadTags(props: SiteHeadProps, page: SiteHeadPage): SiteHeadTags {
  const type = props.type ?? 'website'
  const canonical = resolveUrl(props.canonical ?? page.pathname, page.site)
  const image =
    props.image === undefined
      ? null
      : resolveUrl(typeof props.image === 'string' ? props.image : props.image.src, page.site)
  const imageAlt = typeof props.image === 'object' ? props.image.alt : undefined
  const meta: SiteHeadMeta[] = [
    { name: 'description', content: props.description },
    { property: 'og:type', content: type },
    { property: 'og:title', content: props.title },
    { property: 'og:description', content: props.description },
    { name: 'twitter:title', content: props.title },
    { name: 'twitter:description', content: props.description },
    {
      name: 'twitter:card',
      content: props.card ?? (image === null ? 'summary' : 'summary_large_image'),
    },
  ]
  if (props.noindex === true) meta.push({ name: 'robots', content: 'noindex' })
  if (canonical !== null) meta.push({ property: 'og:url', content: canonical })
  if (props.siteName !== undefined) meta.push({ property: 'og:site_name', content: props.siteName })
  if (props.locale !== undefined) meta.push({ property: 'og:locale', content: props.locale })
  if (props.twitterSite !== undefined)
    meta.push({ name: 'twitter:site', content: props.twitterSite })
  if (image !== null) {
    meta.push({ property: 'og:image', content: image }, { name: 'twitter:image', content: image })
    if (imageAlt !== undefined)
      meta.push(
        { property: 'og:image:alt', content: imageAlt },
        { name: 'twitter:image:alt', content: imageAlt },
      )
  }
  if (type === 'article') {
    if (props.published !== undefined)
      meta.push({ property: 'article:published_time', content: iso(props.published) })
    if (props.modified !== undefined)
      meta.push({ property: 'article:modified_time', content: iso(props.modified) })
    for (const author of props.authors ?? [])
      meta.push({ property: 'article:author', content: authorName(author) })
    for (const tag of props.tags ?? []) meta.push({ property: 'article:tag', content: tag })
  }
  return {
    title: props.title,
    canonical,
    meta,
    jsonLd: type === 'article' ? articleJsonLd(props, canonical, image) : null,
  }
}

function articleJsonLd(
  props: SiteHeadProps,
  canonical: string | null,
  image: string | null,
): Record<string, unknown> {
  const authors = (props.authors ?? []).map((a) => ({
    '@type': 'Person',
    name: authorName(a),
    ...(typeof a === 'object' && a.url !== undefined && { url: a.url }),
  }))
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: props.headline ?? props.title,
    description: props.description,
    ...(props.published !== undefined && { datePublished: iso(props.published) }),
    ...(props.modified !== undefined && { dateModified: iso(props.modified) }),
    ...(authors.length > 0 && { author: authors }),
    ...(image !== null && { image }),
    ...(props.tags !== undefined && props.tags.length > 0 && { keywords: props.tags.join(', ') }),
    ...(canonical !== null && { mainEntityOfPage: { '@type': 'WebPage', '@id': canonical } }),
  }
}

/** A JSON-LD object as the text of a `<script type="application/ld+json">`: `<` escaped so the text cannot close the tag. */
export function jsonLdText(value: Record<string, unknown>): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}
