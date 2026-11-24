// Blocks: see color-literal.tsx.

// @invalid
// oxlint-disable-next-line basalt/colour-literal -- canvas draws raw pixels
const a = 1

// @invalid
/* oxlint-disable-next-line basalt/fixed-colour, basalt/app-colour-arbitrary -- the print sheet */
const a = 1

// @invalid
const a = 1 // oxlint-disable-line basalt/app-colour -- the brand sheet

// @valid
// oxlint-disable-next-line basalt/color-literal -- a photo overlay draws its own dim
const a = 1

// @valid
// oxlint-disable-next-line basalt/app-color-arbitrary -- the print sheet
const a = 1

// @valid
// the 2.x id basalt/colour-literal is gone; this comment names it without a directive
const a = 1
