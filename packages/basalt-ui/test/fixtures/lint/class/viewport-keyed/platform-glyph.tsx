// expect: test(navigator.userAgent)
// expect: test(navigator.userAgent)
// expect: navigator.userAgent.includes
// expect: test(navigator.userAgent)
// expect: navigator.userAgent.match
export const mac = /Mac|iPhone|iPad/.test(navigator.userAgent)
export const glyph = /^(?:Win|Linux)/i.test(window.navigator.userAgent) ? 'Ctrl' : '⌘'
export const apple = () => navigator.userAgent.includes('Mac')
const APPLE = /Macintosh|MacIntel|iPod/
export const chord = APPLE.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
export const windows = navigator.userAgent.match(/\bWindows\b/)
