import { describe, expect, it } from 'bun:test'

import { dropMisreadDirectives } from './waiver-needs-reason'

const finding = (id: string, line: number, file = 'src/a.tsx') => ({ file, line, id, message: id })

describe('dropMisreadDirectives', () => {
  it('drops the per-word unused directives on a line waiver-needs-reason reports', () => {
    const findings = [
      finding('basalt/waiver-needs-reason', 3),
      finding('oxlint/unused-directive', 3),
      finding('oxlint/unused-directive', 3),
    ]
    expect(dropMisreadDirectives(findings)).toEqual([finding('basalt/waiver-needs-reason', 3)])
  })

  it('keeps an unused directive on any other line or file', () => {
    const findings = [
      finding('basalt/waiver-needs-reason', 3),
      finding('oxlint/unused-directive', 4),
      finding('oxlint/unused-directive', 3, 'src/b.tsx'),
    ]
    expect(dropMisreadDirectives(findings)).toEqual(findings)
  })
})
