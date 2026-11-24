// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/color-literal.tsx).

// @invalid
const a = { transition: 'opacity 300ms ease' }

// @invalid
const b = { transitionDuration: '.3s' }

// @invalid
const c = { 'transition-timing-function': 'cubic-bezier(0.2, 0, 0, 1)' }

// @invalid
const d = { animationTimingFunction: 'ease-out' }

// @invalid
const e = { transition: `opacity 0.2s, transform 1s` }

// @valid
const f = { transition: 'opacity var(--basalt-dur-fast) var(--basalt-ease-exit)' }

// @valid
const g = { transitionDelay: '0s', transition: 'none' }

// @valid
const h = { animation: `spin var(--basalt-dur-slow) var(--basalt-ease-standard) infinite` }
