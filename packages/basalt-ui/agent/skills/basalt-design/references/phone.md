# Phone

What basalt does on a phone by itself, and what an app must not add. The touch rules are shipped in the token sheet and the shell; an app that repeats one fights it.

## The pointer decides, not the width

- Touch sizing follows `(pointer: coarse)`, never the viewport width. A narrowed desktop window keeps the fine-pointer sizes.
- The hit floor is 44 px under coarse and 24 px under fine (`--basalt-hit`). Read the token; never write the number.

## Inputs

- An input computes 16 px font on coarse and the normal control size on fine. One shared rule (`css/touch.css`), imported by `tailwind.css` and `styles.css`.
- The token sheet raises the control height to 44 px on coarse.
- An app never sets `maximum-scale` or `user-scalable`. The viewport meta is `width=device-width, initial-scale=1, viewport-fit=cover`; `init` writes it and `basalt()` injects it when the page has none.
- An app never lowers an input's font size, never sets `--basalt-ctl-h` or `--basalt-row-h`, and never adds `min-h-11` to a control.

## Safe areas

- The shell pads top, left and right with `env(safe-area-inset-*)`, and its root pads the bottom from `md`; on a phone the bottom bar pads its own inset. The viewport meta's `viewport-fit=cover` makes those insets real.
- An app adds no safe-area padding to the frame or to a page. Page code gets the gutter from `Page`.
- A full-height surface uses `dvh` (`h-dvh`, `min-h-dvh`), never `vh`.

## Keyboard

- While a text field has focus on a phone, the bottom tab bar leaves the screen.
- `Sheet` forms are keyboard-aware: the field stays above the keyboard.
- An app writes no `visualViewport` code, no keyboard offset and no resize listener for the keyboard.

## Sheet on a phone

- A `Sheet` on a phone is a bottom sheet with a grabber.
- `snapPoints={['half', 'full']}` sets its resting heights, smallest first. Unset, there is one snap at the content height, capped at 90dvh. A drag down from the lowest snap dismisses it.
- An app builds no bottom drawer of its own.

## Tooltips

- A `Tooltip` on a control that has a visible label does nothing on touch. The label is the name; the tooltip adds nothing there.
- A `Tooltip` that carries the only name of an icon button shows on long press.
- Explanatory text belongs to `InfoHint`, never to a `Tooltip`.

## Hover, press and touch

- Hover styles sit behind `(hover: hover)`. Tailwind's `hover:` variant is already gated that way; a bare `:hover` rule in app CSS is not.
- `Button` and row parts carry a pressed style. An app adds none to a part that has one.
- Controls carry `touch-action: manipulation`. An app adds no `touch-action` to them.
- Never rely on hover to reveal an action. A row action, a delete or a menu trigger is visible or reachable by tap.

## The check

- At 390x844, `basalt-ui shot <route>` frames: the answer stays in view, no text is cut, every action is reachable by tap, and a sheet clears the keyboard.
