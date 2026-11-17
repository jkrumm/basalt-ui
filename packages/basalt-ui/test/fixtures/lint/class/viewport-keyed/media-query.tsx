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
// expect: window.visualViewport.width < 640
// expect: globalThis.visualViewport.width >= 1024
// expect: matchMedia('(orientation: portrait)')
// expect: useMediaQuery('(min-height: 600px)')
// expect: matchMedia('(min-aspect-ratio: 16/9)')
// expect: matchMedia('(max-device-width: 480px)')
// expect: test(navigator.userAgent)
// expect: navigator.userAgent.includes
// expect: navigator.userAgent.match
// expect: isMobile
// expect: isTablet
// expect: navigator.userAgentData.mobile
// expect: navigator.userAgentData.mobile
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
export const o = () => (window.visualViewport?.width ?? 0) < 640
export const q = globalThis.visualViewport.width >= 1024
export const orient = window.matchMedia('(orientation: portrait)').matches
export const tall = useMediaQuery('(min-height: 600px)')
export const wide = matchMedia('(min-aspect-ratio: 16/9)')
export const dev = matchMedia('(max-device-width: 480px)')
export const sniff = /Mobi|Android|iPhone/i.test(navigator.userAgent)
export const sniffed = () => navigator.userAgent.includes('Mobile')
export const matched = window.navigator.userAgent.match(/iPhone/)
import { isMobile, isTablet as tablet } from 'react-device-detect'
export function Layout() {
  return isMobile ? 'tabs' : tablet ? 'split' : 'rail'
}
export const handheld = () => navigator.userAgentData?.mobile === true
export const hinted = window.navigator.userAgentData.mobile ? 'tabs' : 'rail'
