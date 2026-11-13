// Blocks: see colour-literal.tsx.

// @invalid
// oxlint-disable-next-line basalt/colour-literal
const a = 1

// @invalid
const a = 1 // oxlint-disable-line basalt/colour-literal

// @invalid
/* oxlint-disable-next-line basalt/colour-literal -- */
const a = 1

// @invalid
// eslint-disable-next-line no-console
console.log(a)

// @invalid
// @filename src/stage/overlay.ts
// @options {"deepRender":["src/stage/overlay.ts"]}
// @errors missing-reason
/* oxlint-disable basalt/colour-literal */
const a = 1

// @valid
// oxlint-disable-next-line basalt/colour-literal -- canvas draws raw pixels
const a = 1

// @valid
const a = 1 // oxlint-disable-line basalt/colour-literal -- canvas draws raw pixels

// @valid
/* oxlint-disable-next-line basalt/colour-literal, basalt/data-primitive -- legacy bridge, see EP-12 */
const a = 1

// @valid
// see oxlint-disable-next-line basalt/colour-literal for the story
const a = 1

// @valid
/* note: oxlint-disable-next-line x */
const a = 1

// @valid
// oxlint-enable basalt/colour-literal
const a = 1
