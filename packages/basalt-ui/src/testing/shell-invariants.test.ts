import { describe, expect, test } from 'bun:test'
import { judgeShell } from './shell-invariants'
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
  }
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

  test('an uneven nav step and a footer on another pitch break', () => {
    const g = healthy()
    g.navRows = [{ box: box(54, 86) }, { box: box(87, 119) }, { box: box(125, 157) }]
    g.footerRows = [
      { name: 'Settings', box: box(1125, 1157) },
      { name: 'Account menu', box: box(1167, 1190) },
    ]
    const broken = judgeShell(g).join('\n')
    expect(broken).toContain('footer rows pitch')
    expect(broken).toContain('Account menu" height 23')
  })
})
