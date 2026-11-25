import type { SiteLink, SiteLinkGroup } from 'basalt-ui/static'

/** The header's links; `current` marks the page being rendered. */
export function navFor(path: string): SiteLink[] {
  const here = path.replace(/\/$/, '')
  return [
    { href: '/guides/setup/', label: 'Guides' },
    { href: '/showcase/', label: 'Showcase' },
    { href: '/posts/', label: 'Posts' },
    { href: '/changelog/', label: 'Changelog' },
  ].map((link) => ({ ...link, current: here.startsWith(link.href.replace(/\/$/, '')) }))
}

export const FOOTER: readonly SiteLinkGroup[] = [
  {
    title: 'Pages',
    links: [
      { href: '/guides/setup/', label: 'Guides' },
      { href: '/showcase/', label: 'Showcase' },
      { href: '/posts/', label: 'Posts' },
      { href: '/changelog/', label: 'Changelog' },
    ],
  },
]

/** The words the static parts show; this site is English. */
export const LABELS = {
  nav: 'Main',
  menu: 'Menu',
  scheme: 'Color scheme',
  schemes: { light: 'Light', dark: 'Dark', auto: 'System' },
  copy: 'Copy code',
  copied: 'Copied',
  toc: 'On this page',
  guides: 'Guides',
  pages: 'Pages',
  previous: 'Previous',
  next: 'Next',
  posts: 'Posts',
} as const

/** Whole minutes to read `body` at 200 words a minute, at least one. */
export function readingMinutes(body: string | undefined): number {
  return Math.max(1, Math.round((body ?? '').split(/\s+/).filter(Boolean).length / 200))
}

/** A day as a reader writes it: UTC, so the build host's zone never moves it. */
export const day = (date: Date): string =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
