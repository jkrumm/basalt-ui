import type { ReactNode } from 'react'

/** One link of a site's navigation; `current` marks the page the reader is on. */
export type SiteLink = {
  href: string
  label: string
  current?: boolean
}

/** A titled group of links (a footer column, a docs sidebar section). */
export type SiteLinkGroup = {
  title: string
  links: readonly SiteLink[]
}

/** One entry of a table of contents; Astro's `headings` (`depth`, `slug`, `text`) map onto it. */
export type TocEntry = {
  id: string
  label: string
  level: number
}

/** A link drawn as a button: a page block's call to action. At most one in a row is `primary`. */
export type SiteAction = {
  href: string
  label: string
  primary?: boolean
}

/** A node a consumer renders: a label from its own message catalogue, a logo, a link. */
export type Slot = ReactNode
