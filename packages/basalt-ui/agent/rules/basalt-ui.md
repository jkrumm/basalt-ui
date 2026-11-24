---
source: basalt-ui
description: Imports, primitives and layout — the laws every basalt-ui file obeys.
---

# Basalt UI

Compose the shipped surface; each bullet names the lint id or type that holds it.

## Imports

- Import a primitive from `basalt-ui/ui/<name>`; never `@base-ui/react`, Radix, cmdk, sonner, streamdown or tailwind-merge. [lint:import-boundary]
- Compose classes with `cn()`; a chart kind, a table and a command palette come from their basalt subpath, never the library under them. [lint:import-boundary]
- A hook that owns a stream or a client is created outside the hook and passed in: `useChat({ chat })`. [lint:import-boundary]

## Primitives

- Use the primitive for a control, a checkable input, a heading and a table; never the raw element. [lint:primitive-bypass]
- A static table is the table primitive; data is `DataTable`; hand-drawn chart marks are a chart kind. [lint:primitive-bypass]
- A surface the app draws itself (a game table, a seating plan) lives in one directory listed under `bespoke` in `.basalt/manifest.json`, then `basalt-ui sync`; there a mark is placed from state through a custom property a class reads (`style={{ '--x': … }}` with `left-(--x)`) or drawn as SVG, and every other rule still runs, so an inline `left` or a raw control still fails. [lint:primitive-bypass]
- A scroll region is the scroll primitive, or the page owns the scroll; never a raw overflow box. [lint:raw-scroll]
- An icon prop takes any component with the `IconComponent` shape; the recommended set is `lucide-react`, passed as its component (`icon={Users}`). [type:IconComponent]
- A link prop takes `string | NavTarget`; install `routerDefaults().link` once on `BasaltProvider link`, never per prop; without it a target is a plain anchor. [type:LinkComponent]

## Layout

- Key layout on the container (`@narrow:`, `@regular:`, `@wide:`), never on the viewport or a media query. [lint:viewport-keyed]
- Chrome follows `useSizeClass()`; page layout follows its container. [type:SizeClass]
- A numeric container query is a named size; a fixed child width is the parent's job. [lint:tw-off-law]

## Waivers and gates

- A waiver is `// oxlint-disable-next-line basalt/<id> -- <why>` on the line; a file-level waiver exists only for the deep-render paths the manifest declares. [lint:waiver-needs-reason]

not guarded:

- Icons draw at 16 px (`size-icon`) with the 1.5 px stroke of the shipped glyphs: `<LucideProvider size={16} strokeWidth={1.5} absoluteStrokeWidth>` once at each React root, which the `init` root templates mount; keep it when you edit the root.
- Read `node_modules/basalt-ui/docs/<name>.md` before guessing an import or a prop; a missing export is a recipe in `docs/recipes/`, never a local copy.
- Never `shadcn add` a primitive basalt ships; to change one, eject it with `basalt-ui eject <name> --reason`.
- Run the repo gate before reporting done; the editor hook is a floor, not the gate.
- A field names its `autoComplete` token and a numeric one its `inputMode`; it validates on blur and on submit (`validators.onBlur`), never on every change.
