// Blocks: a `// @valid` or `// @invalid` header starts one; `// @errors a,b` names the message ids
// an invalid block reports (default: this form), `// @filename`, `// @options <json>` and `// @ts`
// (oxlint only: needs a TS parser) set the run. The test (src/lint/rules/structure/color-literal.test.ts) feeds each block to the rule.

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
const fill = BASALT.accent

// @valid
const wash = alpha(BASALT.surface.panel, 0.4)

// @valid
const wrapped = 'rgb(var(--basalt-accent) / 50%)'

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

// @invalid
// A call named defineSeries is no exemption: the series file is the one place a pair is written.
const SERIES = defineSeries({ sessions: { light: '#2871c7', dark: '#5190f7' } })
const other = { light: '#ff8800', dark: '#112233' }
// @errors color-literal,color-literal,color-literal,color-literal

// @valid
// @filename src/basalt.tokens.ts
export default {
  series: { app: { sessions: { light: '#2871c7', dark: '#5190f7' } } },
}

// @invalid
const nested = defineSeries({ sessions: { light: BASALT.accent, extra: '#2871c7' } })

// @invalid
ctx.strokeStyle = 'white'

// @invalid
ctx.fillStyle = dark ? BASALT.ink : 'Gainsboro'

// @invalid
ctx.shadowColor = 'red'

// @invalid
const style = { color: 'red', backgroundColor: 'whitesmoke' }

// @errors color-literal,color-literal
// @invalid
const mark = <rect fill="steelblue" stroke="black" />

// @errors color-literal,color-literal
// @valid
ctx.strokeStyle = BASALT.ink
ctx.fillStyle = 'transparent'
ctx.shadowColor = alpha(BASALT.ink, 0.2)

// @valid
const style = { color: 'inherit', fill: 'none', stroke: 'currentColor', background: 'transparent' }

// @valid
const mark = <rect fill="currentColor" stroke="none" />

// @valid
const label = 'white'
const tone = { tone: 'red' }
const text = <span title="red">white</span>

// @valid
// @filename scenarios/swatch.test.tsx
const input = { color: 'red' }

// @valid
const issues = [{ ref: '#657' }, { issue: '#1042', id: '#123', issueRef: '#881' }]
const row = { rowId: '#456', number: '#789' }

// @invalid
const mark = { color: '#123', fill: '#456' }
// @errors color-literal,color-literal

// @invalid
const paint = { 'line-color': 'crimson' }

// @invalid
const circle = { 'circle-color': 'white', 'fill-color': 'steelblue' }
// @errors color-literal,color-literal

// @invalid
const edge = { stroke: 'hsl(var(--border))' }

// @invalid
const ring = 'rgb(var(--ring))'

// @invalid
const tone = `oklch(var(--accent))`

// @valid
const wrapped = 'hsl(var(--basalt-accent))'
const alpha = 'rgb(var(--basalt-accent) / 50%)'
const label = { 'line-width': 'wide', 'text-field': 'white' }

// @valid
const toc = [{ href: '#add', label: 'Add' }, { to: '#cafe' }, { hash: '#feed' }]
const anchor = <a href="#add">Add</a>

// @invalid
const notAnchor = { label: '#add' }

// @invalid
const wide = 'color(display-p3 0.1 0.5 0.9)'

// @invalid
const wideTemplate = `color(srgb ${r} ${g} ${b})`

// @valid
const mixed = 'color-mix(in oklch, var(--basalt-accent) 50%, transparent)'
const word = 'color(red)'
const label = 'Choose a color(s)'

// @invalid
const style = { boxShadow: '0 0 8px rgb(from var(--basalt-brand) r g b / 50%)' }

// @invalid
const tint = 'oklch(from var(--basalt-accent) l c h / 40%)'

// @invalid
const wash = `hsl(from var(--basalt-accent) h s l / ${pct}%)`

// @invalid
const wide = 'color(from var(--basalt-accent) srgb r g b / 50%)'

// @valid
const nearby = 'url(#from)'
const word = 'Choose a color from the palette'
const fn = 'format(from the list)'
