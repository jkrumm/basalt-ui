# Overlays on a phone, 2026-11-24

Frames of the playground page `/kit/overlays` (Issue 3207): each list overlay at 390x844 with a touch
pointer, where it opens as a sheet from the bottom, and at 1440x900 with a mouse, where it stays the
anchored popup (or, for the palette, the dialog, and for the dock, the side panel). Light and dark.

File names are `<phone|desktop>-<light|dark>-<case>.png`. Cases: `select`, `select-search`, `combobox`,
`menu`, `date-picker`, `popover-tall`, `dialog-form`, `palette`, `dock`, `select-in-sheet`.

Taken from a production build of the playground in Playwright's headless Chromium, a phone context
with touch and a device scale factor of 2 and a desktop context at 1; not a device. The keyboard,
the safe-area insets and the iOS focus rules are not in these frames.
