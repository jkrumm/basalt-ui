// Blocks: a `// @valid` or `// @invalid` header starts one; `// @errors a,b` names the message ids
// an invalid block reports (default: this form), `// @filename`, `// @options <json>` and `// @ts`
// (oxlint only: needs a TS parser) set the run. The test (src/lint/rules/structure/colour-literal.test.ts) feeds each block to the rule.

// @invalid
const fill = '#ff8800'

// @invalid
const stroke = '#FFF'

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
const quoted = "url('#fade')"

// @valid
const issue = 'Fixes #123 in the changelog'

// @valid
const entity = '&#x1F600;'

// @valid
import tokens from '#ff8800'

// @valid
const SERIES = defineSeries({
  sessions: { light: '#2871c7', dark: '#5190f7' },
  churn: { light: 'oklch(0.6 0.2 25)', dark: '#e46360' },
})

// @valid
export const traceColors = groupTokens(
  'trace',
  tokens.defineSeries({
    model: { light: '#2871c7', dark: '#5190f7' },
  }),
)

// @invalid
const SERIES = defineSeries({ sessions: { light: '#2871c7', dark: '#5190f7' } })
const other = { light: '#ff8800', dark: '#112233' }
const warn = '#ff8800'
// @errors colour-literal,colour-literal,colour-literal

// @invalid
const nested = defineSeries({ sessions: { light: VX.accent, extra: '#2871c7' } })
