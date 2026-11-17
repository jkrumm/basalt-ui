// expect: test(navigator.userAgent)
// expect: test(navigator.userAgent)
// expect: navigator.userAgent.includes
// expect: test(navigator.userAgent)
// expect: navigator.userAgent.match
// expect: test(navigator.userAgent)
export const mac = /Mac|iPhone|iPad/.test(navigator.userAgent)
export const glyph = /^(?:Win|Linux)/i.test(window.navigator.userAgent) ? 'Ctrl' : '⌘'
export const apple = () => navigator.userAgent.includes('Mac')
const APPLE = /Macintosh|MacIntel|iPod/
export const chord = APPLE.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
export const windows = navigator.userAgent.match(/\bWindows\b/)
export const label = /Mac|Win/.test(navigator.userAgent) ? '/dl/app.dmg' : 'Download for Windows'
