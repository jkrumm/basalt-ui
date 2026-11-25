# Docs theme frames (Issue 3302)

Frames of the Starlight docs on basalt-ui.com before and after `basalt-ui/starlight.css` took basalt's palette,
code frames and density. `before-*` is the old sheet, `after-*` the new one, both over the same content (the
installation page carries real asides in both).

Names are `<set>-<page>-<width>-<scheme>.png`: pages `docs` (index), `docs_installation` (code blocks) and
`docs_installation-aside` (asides); widths 1440 and 390; schemes light and dark.

## Reference docs sites

- shadcn/ui docs (ui.shadcn.com/docs): 30 px page title, 13 px sidebar links in a soft selected pill, a small muted
  "On this page", code in a quiet bordered block. The current page is a neutral fill, never a brand color.
- Tailwind CSS docs (tailwindcss.com/docs): 30 px title, 14 px sidebar, a single hairline marking the current page,
  8 px code radius with a small caption row, no window dots.

What the sheet takes from both: a 30 px title, 13 px chrome, muted section labels, a selected row for the current page
and a flat bordered code block with an optional caption.
