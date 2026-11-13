// Blocks: a `// @valid` or `// @invalid` header starts one; `// @errors a,b` names the message ids
// an invalid block reports (default: this form), `// @filename`, `// @options <json>` and `// @ts`
// (oxlint only: needs a TS parser) set the run. The test (src/lint/rules/structure/colour-literal.test.ts) feeds each block to the rule.

// @invalid
const fill = '#ff8800'

// @invalid
const stroke = "#FFF"

// @invalid
const wash = '#00000080'

// @invalid
const edge = 'rgba(0, 0, 0, 0.4)'

// @invalid
const tint = `hsl(${hue}, 60%, 50%)`

// @invalid
const style = { color: 'oklch(0.7 0.1 250)' }

// @invalid
const shorthand = '1px solid #ddd'

// @valid
const fill = VX.accent

// @valid
const wash = alpha(VX.surface.panel, 0.4)

// @valid
const wrapped = 'rgb(var(--vx-accent) / 50%)'

// @valid
const relative = 'oklch(from var(--vx-accent) l c h)'

// @valid
const gradient = 'url(#fade)'

// @valid
const issue = 'Fixes #123 in the changelog'

// @valid
const entity = '&#x1F600;'

// @valid
import tokens from '#ff8800'
