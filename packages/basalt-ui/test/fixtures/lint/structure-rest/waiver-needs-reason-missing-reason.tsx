// Blocks: see color-literal.tsx.

// @invalid
// oxlint-disable-next-line basalt/color-literal
const a = 1

// @invalid
const a = 1 // oxlint-disable-line basalt/color-literal

// @invalid
/* oxlint-disable-next-line basalt/color-literal -- */
const a = 1

// @invalid
// eslint-disable-next-line no-console
console.log(a)

// @invalid
// @filename src/stage/overlay.ts
// @options {"deepRender":["src/stage/overlay.ts"]}
// @errors missing-reason
/* oxlint-disable basalt/color-literal */
const a = 1

// @invalid
// oxlint-disable-next-line basalt/dark-fork — the logo needs its own dark tone
const a = 1

// @valid
// oxlint-disable-next-line basalt/color-literal -- canvas draws raw pixels
const a = 1

// @valid
const a = 1 // oxlint-disable-line basalt/color-literal -- canvas draws raw pixels

// @valid
/* oxlint-disable-next-line basalt/color-literal, basalt/data-primitive -- legacy bridge, see EP-12 */
const a = 1

// @valid
// see oxlint-disable-next-line basalt/color-literal for the story
const a = 1

// @valid
/* note: oxlint-disable-next-line x */
const a = 1

// @valid
// oxlint-enable basalt/color-literal
const a = 1

// @invalid
// oxlint-disable-next-line basalt/raw-scroll -- TODO
const a = 1

// @invalid
// oxlint-disable-next-line basalt/raw-scroll -- fixme:
const a = 1

// @invalid
const a = 1 // oxlint-disable-line basalt/color-literal -- tbd.

// @invalid
/* eslint-disable-next-line no-console -- XXX */
console.log(a)

// @valid
// oxlint-disable-next-line basalt/raw-scroll -- TODO(EP-12): the chart owns its scroll
const a = 1
