import type { SiteLink, SiteLinkGroup, SiteMenuEntry, SiteNavItem } from "basalt-ui/static";

/** The header's items: two links and two menus, one of tiles and one of rows. */
export const NAV: readonly SiteNavItem[] = [
  { href: "/docs/introduction", label: "Docs" },
  {
    label: "Guides",
    menu: [
      {
        entries: [
          {
            href: "/guides/content-sites",
            label: "Content sites",
            description: "Static parts for an Astro page, no client JavaScript",
            image: { src: "/menu/content-sites.svg", width: 320, height: 180 },
          },
          {
            href: "/guides/interactive-content",
            label: "Interactive content",
            description: "Tabs, a table and a form that need no script",
            image: { src: "/menu/interactive-content.svg", width: 320, height: 180 },
          },
          {
            href: "/guides/islands-in-mdx",
            label: "Islands in MDX",
            description: "A sortable table and a chart, each with its cost",
            image: { src: "/menu/islands-in-mdx.svg", width: 320, height: 180 },
          },
        ],
      },
    ],
  },
  {
    label: "Tokens",
    menu: [
      {
        entries: [
          { href: "/colors", label: "Colors", description: "The derived palette, light and dark" },
          {
            href: "/typography",
            label: "Typography",
            description: "Three faces and a seven-step scale",
          },
          {
            href: "/spacing",
            label: "Spacing",
            description: "The ladder behind every gap and gutter",
          },
        ],
      },
    ],
  },
  { href: "/charts", label: "Charts" },
  { href: "/changelog", label: "Changelog" },
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
      { href: "/colors", label: "Colors" },
      { href: "/typography", label: "Typography" },
      { href: "/spacing", label: "Spacing" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "/guides", label: "Guides" },
      { href: "/changelog", label: "Changelog" },
      { href: "https://github.com/jkrumm/basalt-ui", label: "GitHub" },
      { href: "https://www.npmjs.com/package/basalt-ui", label: "npm" },
    ],
  },
];

/** The words the static parts show; this site is English. */
export const LABELS = {
  nav: "Main",
  menu: "Menu",
  scheme: "Color scheme",
  schemes: { light: "Light", dark: "Dark", auto: "System" },
  copy: "Copy code",
  copied: "Copied",
  toc: "On this page",
  guides: "Guides",
  pages: "Pages",
  previous: "Previous",
  next: "Next",
  yes: "Yes",
  no: "No",
} as const;

/** Whole minutes to read `body` at 200 words a minute, at least one. */
export function readingMinutes(body: string | undefined): number {
  return Math.max(1, Math.round((body ?? "").split(/\s+/).filter(Boolean).length / 200));
}

/** A day as a reader writes it: UTC, so the build host's zone never moves it. */
export const day = (date: Date): string =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);

/** Marks the link or menu entry of the page being rendered. */
export function current(items: readonly SiteNavItem[], path: string): SiteNavItem[] {
  const here = path.replace(/\/$/, "") || "/";
  const mark = <T extends SiteLink | SiteMenuEntry>(link: T): T => ({
    ...link,
    current: link.href === here,
  });
  return items.map((item) =>
    "menu" in item
      ? {
          ...item,
          menu: item.menu.map((section) => ({ ...section, entries: section.entries.map(mark) })),
        }
      : mark(item),
  );
}
