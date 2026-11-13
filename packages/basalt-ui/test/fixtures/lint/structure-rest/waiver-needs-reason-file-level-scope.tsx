// Blocks: see colour-literal.tsx.

// @invalid
// raw-scroll is waivable file-wide only on a deepRender path
// @filename src/pages/photos.tsx
// @options {"deepRender":["src/stage/overlay.ts"]}
/* oxlint-disable basalt/raw-scroll -- contact sheet owns a measured scroller */
const a = 1

// @invalid
// @filename src/pages/photos.tsx
/* oxlint-disable basalt/raw-scroll -- contact sheet owns a measured scroller */
const a = 1

// @invalid
// @filename src/stage/overlay.ts
// @options {"deepRender":["src/stage/overlay.ts"]}
/* oxlint-disable basalt/viewport-keyed -- never file-waivable */
const a = 1

// @invalid
// @filename src/stage/overlay.ts
// @options {"deepRender":["src/stage/overlay.ts"]}
/* oxlint-disable basalt/colour-literal, basalt/viewport-keyed -- one unlisted rule is enough */
const a = 1

// @invalid
// @filename src/stage/overlay.ts
// @options {"deepRender":["src/stage/overlay.ts"]}
/* oxlint-disable -- every rule off */
const a = 1

// @invalid
// @filename src/stage/overlay.ts
// @options {"deepRender":["src/stage/overlay.ts"]}
// eslint-disable basalt/data-primitive -- nothing may waive this file-wide
const a = 1

// @valid
// @filename apps/desktop/src/features/editor/stage/overlay.ts
// @options {"deepRender":["apps/desktop/src/features/editor/stage/overlay.ts"]}
/* oxlint-disable basalt/colour-literal -- canvas overlay draws raw pixels */
const a = 1

// @valid
// @filename apps/desktop/src/stage/Stage.tsx
// @options {"deepRender":["apps/desktop/src/stage/**"]}
/* oxlint-disable shadcn/no-inline-styles, basalt/raw-scroll -- /map positions 110 sites by pixel */
const a = 1

// @valid
// @filename src/pages/photos.tsx
// oxlint-disable-next-line basalt/viewport-keyed -- per-line waivers are not file-level
const a = 1

// @valid
// @filename src/pages/photos.tsx
// the oxlint-disable token in prose waives nothing
const a = 1
