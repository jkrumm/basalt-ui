// expect: matchMedia('(min-width: 768px)')
// expect: useMediaQuery('(max-width: 640px)')
// expect: matchMedia('(min-width: ${}px)')
// expect: window.innerWidth < 768
// expect: 1024 <= window.outerWidth
// expect: document.documentElement.clientWidth > 600
// expect: globalThis.innerWidth >= 640
// expect: useMediaQuery('(max-width: 767px)')
// expect: window.innerWidth < 768
// expect: 1024 <= window.outerWidth
// expect: width < 768
// expect: size.width >= 1024
// expect: useWindowSize().width < 640
// expect: w < 768
// expect: useMediaQuery('{ maxWidth }')
// expect: useMediaQuery('(width < 48rem)')
// expect: window.screen.width < 768
// expect: screen.availWidth >= 1200
// expect: size.width >= 1024
export const a = window.matchMedia('(min-width: 768px)')
export const b = useMediaQuery('(max-width: 640px)')
export const c = matchMedia(`(min-width: ${bp}px)`)
export const d = window.innerWidth < 768
export const e = 1024 <= window.outerWidth
export const f = document.documentElement.clientWidth > 600
export const g = globalThis.innerWidth >= 640
const MOBILE_QUERY = '(max-width: 767px)'
const BREAKPOINT = 768
const WIDE = 1024
export const h = useMediaQuery(MOBILE_QUERY)
export const i = () => window.innerWidth < BREAKPOINT
export const j = WIDE <= window.outerWidth
export function Nav() {
  const { width } = useWindowSize()
  const size = useWindowSize()
  const { width: w = 0 } = useWindowSize()
  return [width < 768, size.width >= 1024, useWindowSize().width < 640, w < BREAKPOINT]
}
export const k = useMediaQuery({ maxWidth: 767 })
export const l = useMediaQuery({ query: '(width < 48rem)' })
export const m = window.screen.width < 768
export const n = screen.availWidth >= 1200
import { useWindowSize as useSize } from '@uidotdev/usehooks'
export function TwoCol() {
  const size = useSize()
  return size.width !== null && size.width >= 1024
}
