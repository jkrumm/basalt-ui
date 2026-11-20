import type {
  SiteAction,
  SiteComparisonColumn,
  SiteComparisonRow,
  SiteQuestion,
} from "basalt-ui/static";

/** The landing page's words and data; the page only arranges them. */
export const HERO = {
  eyebrow: "basalt-ui 3",
  title: "Dashboards, docs and content sites in one look.",
  description:
    "A React framework on Base UI and Tailwind 4. Apps get the shell, charts and tables; content sites get static parts with no client JavaScript.",
  actions: [
    { href: "/docs/introduction", label: "Get started", primary: true },
    { href: "https://github.com/jkrumm/basalt-ui", label: "GitHub" },
  ] satisfies SiteAction[],
} as const;

export const BENTO = {
  title: "One kit, two kinds of page",
  description:
    "Every tile below holds the real part, rendered to HTML on this page. None of them loads a script of its own.",
  dashboards: {
    title: "The cards of a dashboard",
    description:
      "The stat cards of an app's overview render here as static HTML, sparklines included.",
  },
  scheme: {
    title: "Light, dark or system",
    description:
      "One stored choice, shared with the docs. A few lines of inline script, no island.",
  },
  code: {
    title: "A landing page is a list of blocks",
    description: "Hero, bento, comparison, questions and a closing band, each a static part.",
  },
  callout: {
    title: "Notes beside the text",
    description:
      "Callouts, code with a copy button and prose styled by element, for Markdown you did not write.",
  },
  calloutNote: {
    title: "No baked words",
    text: "Every label and accessible name is a prop, so your message catalogue decides the language.",
  },
} as const;

export const BLOCKS_SNIPPET = `---
import { SiteHero, SiteBento, SiteFeature } from 'basalt-ui/static'
---
<SiteHero title="Plan a sprint in one call" actions={actions} />
<SiteBento title="What you get">
  <SiteFeature title="Static" span="wide">…</SiteFeature>
</SiteBento>`;

export const COMPARISON = {
  title: "Pick the profile that fits the page",
  description:
    "A profile is declared once in the manifest. The lowest one that covers what a page imports is the right one.",
  caption: "basalt-ui profiles compared",
  rowHeader: "Profile",
  columns: [
    { key: "tokens", label: "tokens" },
    { key: "site", label: "site", ours: true },
    { key: "app", label: "app" },
  ] satisfies SiteComparisonColumn[],
  rows: [
    {
      label: "Made for",
      values: { tokens: "Email, plain HTML", site: "Astro content sites", app: "Multi-page apps" },
    },
    { label: "Tokens and fonts", values: { tokens: true, site: true, app: true } },
    { label: "Tailwind 4 and the lint preset", values: { tokens: false, site: true, app: true } },
    { label: "Static parts", values: { tokens: false, site: true, app: false } },
    { label: "App shell and router", values: { tokens: false, site: false, app: true } },
    {
      label: "Client JavaScript",
      values: { tokens: "None", site: "None outside islands", app: "A React app" },
    },
  ] satisfies SiteComparisonRow[],
} as const;

export const QUESTIONS = {
  title: "Questions",
  description: "What people ask before they put basalt on a content site.",
  items: [
    {
      id: "javascript",
      question: "Does a static page ship JavaScript?",
      answer:
        "No module script. Every part in basalt-ui/static renders to HTML; one inline script of under 2 kB gzip runs the theme switch and the copy button. An island is something you opt into, page by page.",
    },
    {
      id: "astro",
      question: "Do the parts need Astro?",
      answer:
        "No. They are React components with no provider, no hook and no router, so they render the same in Astro, TanStack Start or any server render.",
    },
    {
      id: "labels",
      question: "How do I translate the labels?",
      answer:
        "Pass them in. Every visible word and accessible name is a prop, so the strings come from your own message catalogue; basalt bakes none in.",
    },
    {
      id: "structured-data",
      question: "Does basalt write structured data for this list?",
      answer:
        "No. The question list takes its questions as an array, so your page can emit FAQPage JSON-LD from the same array; basalt emits none itself.",
    },
    {
      id: "rtl",
      question: "Will a right-to-left language work?",
      answer:
        "The parts use logical CSS properties only, and a lint rule holds them to it, so start and end follow the writing direction.",
    },
  ] satisfies SiteQuestion[],
} as const;

export const CALL_TO_ACTION = {
  title: "Start with one profile",
  description:
    "Install the package, run init with the profile that fits, and build the first page.",
  actions: [
    { href: "/docs/introduction", label: "Read the docs", primary: true },
    { href: "/guides/content-sites", label: "Build a content site" },
  ] satisfies SiteAction[],
} as const;
