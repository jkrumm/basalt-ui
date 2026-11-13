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
- A scroll region is the scroll primitive, or the page owns the scroll; never a raw overflow box. [lint:raw-scroll]
- An icon prop takes any component with the `IconComponent` shape; pass the icon library's own. [type:IconComponent]
- A link prop takes a `LinkComponent`; the default is a plain anchor and `routerDefaults` supplies the router link. [type:LinkComponent]

## Layout

- Key layout on the container (`@narrow:`, `@regular:`, `@wide:`), never on the viewport or a media query. [lint:viewport-keyed]
- Chrome follows `useSizeClass()`; page layout follows its container. [type:SizeClass]
- A numeric container query is a named size; a fixed child width is the parent's job. [lint:tw-off-law]

## Waivers and gates

- A waiver is `// oxlint-disable-next-line basalt/<id> -- <why>` on the line; a file-level waiver exists only for the deep-render paths the manifest declares. [lint:waiver-needs-reason]

not guarded:

- Read `node_modules/basalt-ui/docs/<name>.md` before guessing an import or a prop; a missing export is a recipe in `docs/recipes/`, never a local copy.
- Never `shadcn add` a primitive basalt ships; to change one, eject it with `basalt-ui eject <name> --reason`.
- Run the repo gate before reporting done; the editor hook is a floor, not the gate.
