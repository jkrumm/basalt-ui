import type { ReactNode } from 'react'

/** One link of a site's navigation; `current` marks the page the reader is on. */
export type SiteLink = {
  href: string
  label: string
  current?: boolean
}

/** The picture of a menu tile. Decorative (`alt` empty) unless it carries meaning the title does not. */
export type SiteMenuImage = {
  src: string
  /** Default empty: the title already names the tile. */
  alt?: string
  width?: number
  height?: number
}

/**
 * One entry of a site menu. With an `image` it is a tile (picture, title, one line); without one a
 * link row (title and one line).
 */
export type SiteMenuEntry = {
  href: string
  label: string
  /** The one line under the title. */
  description?: string
  image?: SiteMenuImage
  current?: boolean
}

/** A group of entries in a menu panel and in the phone sheet; `title` heads it when the menu has more than one. */
export type SiteMenuSection = {
  title?: string
  entries: readonly SiteMenuEntry[]
}

/** A top-level item that opens a panel instead of going to a page. */
export type SiteNavMenu = {
  /** The item's text and the panel's accessible name. */
  label: string
  menu: readonly SiteMenuSection[]
}

/** A top-level item of the site header: a link, or a menu that opens a panel. */
export type SiteNavItem = SiteLink | SiteNavMenu

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
