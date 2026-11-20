import type { SiteLink, SiteLinkGroup } from "basalt-ui/static";

/** The primary links, one place for header and footer. */
export const NAV: readonly SiteLink[] = [
  { href: "/docs/introduction", label: "Docs" },
  { href: "/guides/content-sites", label: "Guides" },
  { href: "/colors", label: "Colours" },
  { href: "/typography", label: "Typography" },
  { href: "/spacing", label: "Spacing" },
  { href: "/charts", label: "Charts" },
];

export const FOOTER: readonly SiteLinkGroup[] = [
  {
    title: "Docs",
    links: [
      { href: "/docs/introduction", label: "Introduction" },
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/astro-fonts", label: "Fonts on Astro" },
    ],
  },
  {
    title: "Tokens",
    links: [
      { href: "/colors", label: "Colours" },
      { href: "/typography", label: "Typography" },
      { href: "/spacing", label: "Spacing" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "https://github.com/jkrumm/basalt-ui", label: "GitHub" },
      { href: "https://www.npmjs.com/package/basalt-ui", label: "npm" },
    ],
  },
];

/** The words the static parts show; this site is English. */
export const LABELS = {
  nav: "Main",
  menu: "Menu",
  scheme: "Colour scheme",
  schemes: { light: "Light", dark: "Dark", auto: "System" },
  copy: "Copy code",
  copied: "Copied",
  toc: "On this page",
  pages: "Pages",
  previous: "Previous",
  next: "Next",
} as const;

/** Marks the link of the page being rendered. */
export function current(links: readonly SiteLink[], path: string): SiteLink[] {
  const here = path.replace(/\/$/, "") || "/";
  return links.map((link) => ({ ...link, current: link.href === here }));
}
