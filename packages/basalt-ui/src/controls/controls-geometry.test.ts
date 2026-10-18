/**
 * Two control-geometry rules argo filed in Wave 23 (UPSTREAM § w23-r1), pinned against the shipped
 * CSS text: the filter pill's width cap and the phone `Select`'s inline inset. The rendered boxes are
 * measured in a real browser by `tests/layout/wave37-shell.layout.test.ts`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'

const css = readFileSync(resolve(import.meta.dirname, 'controls.module.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

function rule(selector: string): string {
  const start = css.search(
    new RegExp(String.raw`(^|\n)${selector.replace('.', String.raw`\.`)} \{`),
  )
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('filter pill width', () => {
  test('the cap is above 15rem so a long option name is not clipped at the old bound', () => {
    const cap = /max-width:\s*([\d.]+)rem/.exec(rule('.pill'))
    expect(Number(cap?.[1])).toBeGreaterThan(15)
  })

  test('the label truncates with an ellipsis beyond the cap', () => {
    const label = rule('.pillLabel')
    expect(label).toContain('text-overflow: ellipsis')
    expect(label).toContain('white-space: nowrap')
  })
})

describe('phone Select inset', () => {
  test('the inline-start inset is a control step, not Mantine height / 3 (10.67 px)', () => {
    expect(rule('.phoneSelect input')).toMatch(
      /padding-inline-start:\s*var\(--button-padding-x-ctl\)/,
    )
  })
})
