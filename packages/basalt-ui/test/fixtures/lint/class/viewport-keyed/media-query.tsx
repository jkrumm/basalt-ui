// expect: matchMedia('(min-width: 768px)')
// expect: useMediaQuery('(max-width: 640px)')
// expect: matchMedia('(min-width: ${}px)')
// expect: window.innerWidth < 768
// expect: 1024 <= window.outerWidth
// expect: document.documentElement.clientWidth > 600
// expect: innerWidth >= 640
export const a = window.matchMedia('(min-width: 768px)')
export const b = useMediaQuery('(max-width: 640px)')
export const c = matchMedia(`(min-width: ${bp}px)`)
export const d = window.innerWidth < 768
export const e = 1024 <= window.outerWidth
export const f = document.documentElement.clientWidth > 600
export const g = innerWidth >= 640
