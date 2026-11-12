import { describe, expect, test } from 'bun:test'
import { judgeNative, judgeShell } from './shell-invariants'
import type { ShellGeometry } from './shell-invariants'

const box = (top: number, bottom: number, left = 6, right = 233) => ({ top, bottom, left, right })

/** A healthy expanded desktop frame: 240 rail, 48 header, 32 px rows on a 33 px pitch. */
function healthy(): ShellGeometry {
  return {
    viewport: { width: 1800, height: 1200 },
    document: { scrollWidth: 1800, scrollHeight: 1200, clientHeight: 1200 },
    headerToken: 48,
    header: { top: 0, bottom: 48, left: 0, right: 1800 },
    railVisible: true,
    rail: { top: 48, bottom: 1200, left: 0, right: 240 },
    railState: 'expanded',
    navRows: [{ box: box(54, 86) }, { box: box(87, 119) }, { box: box(120, 152) }],
    footerRows: [
      { name: 'Settings', box: box(1125, 1157) },
      { name: 'Account menu', box: box(1158, 1190) },
    ],
    tabBar: null,
    clipped: [],
    native: null,
  }
}

/** A healthy native-overlay frame: 52 header, an 80 strip, one deep region, no-drag controls. */
function nativeFrame(): ShellGeometry {
  const g = healthy()
  g.headerToken = 52
  g.header = { top: 0, bottom: 52, left: 0, right: 1800 }
  g.native = {
    dragRegions: [{ slot: 'shell-header', value: 'deep' }],
    headerAppRegion: 'drag',
    leadInset: 80,
    titlebar: { top: 0, bottom: 52, left: 0, right: 80 },
    leadContentLeft: 80,
    interactive: [{ name: 'Collapse sidebar', appRegion: 'no-drag' }],
  }
  return g
}

describe('judgeShell', () => {
  test('a healthy frame breaks nothing', () => {
    expect(judgeShell(healthy())).toEqual([])
  })

  test('a 2 px footer inset is under the rail padding', () => {
    const g = healthy()
    g.footerRows = [{ name: 'Account menu', box: box(1158, 1198) }]
    expect(judgeShell(g).join('\n')).toContain('bottom inset 2')
  })

  test('a header off its token, a scrolling document and a clipped label each break', () => {
    const g = healthy()
    g.header = { top: 0, bottom: 52, left: 0, right: 1800 }
    g.document.scrollHeight = 1300
    g.clipped = [
      { slot: 'shell-header', text: 'Export', reason: 'scrollWidth 90 > clientWidth 60' },
    ]
    const broken = judgeShell(g).join('\n')
    expect(broken).toContain('header height 52')
    expect(broken).toContain('document scrolls')
    expect(broken).toContain('"Export" clipped')
  })

  test('a section of one row before a labelled section does not skew the pitch', () => {
    const g = healthy()
    g.navRows = [
      { box: box(54, 86) },
      { box: box(110, 142) },
      { box: box(143, 175) },
      { box: box(176, 208) },
    ]
    expect(judgeShell(g)).toEqual([])
  })

  test('an uneven step inside a section breaks', () => {
    const g = healthy()
    g.navRows = [{ box: box(54, 86) }, { box: box(87, 119) }, { box: box(123, 155) }]
    expect(judgeShell(g).join('\n')).toContain('nav step 2 (36) is off the pitch 33')
  })

  test('an uneven nav step and a footer on another pitch break', () => {
    const g = healthy()
    g.footerRows = [
      { name: 'Settings', box: box(1125, 1157) },
      { name: 'Account menu', box: box(1167, 1190) },
    ]
    const broken = judgeShell(g).join('\n')
    expect(broken).toContain('footer rows pitch')
    expect(broken).toContain('Account menu" height 23')
  })
})

describe('judgeNative', () => {
  test('a healthy native frame breaks nothing', () => {
    expect(judgeNative(nativeFrame())).toEqual([])
    expect(judgeShell(nativeFrame())).toEqual([])
  })

  test('a web page is named as not native', () => {
    expect(judgeNative(healthy()).join('\n')).toContain('not under chrome="native-overlay"')
  })

  test('a 48 header, a short inset and content inside the strip each break', () => {
    const g = nativeFrame()
    g.header = { top: 0, bottom: 48, left: 0, right: 1800 }
    if (g.native) {
      g.native.leadInset = 40
      g.native.titlebar = { top: 0, bottom: 48, left: 0, right: 40 }
      g.native.leadContentLeft = 40
    }
    const broken = judgeNative(g).join('\n')
    expect(broken).toContain('native header height 48')
    expect(broken).toContain('--chrome-lead-inset 40')
    expect(broken).toContain('titlebar strip is 40 wide')
    expect(broken).toContain('inside the 80 px lead inset')
  })

  test('a drag attribute on a button or a second region breaks, so does a draggable control', () => {
    const g = nativeFrame()
    if (g.native) {
      g.native.dragRegions = [
        { slot: 'shell-header', value: 'deep' },
        { slot: 'button', value: '' },
      ]
      g.native.interactive = [{ name: 'Act', appRegion: 'drag' }]
    }
    const broken = judgeNative(g).join('\n')
    expect(broken).toContain('shell-header alone as "deep", found: shell-header="deep", button=""')
    expect(broken).toContain('header control "Act" is app-region "drag", not no-drag')
  })
})
