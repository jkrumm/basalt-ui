/**
 * The static table in real Chrome, styled by the shipped `static.css` alone, the sheet a content site
 * imports. The classes of `ui/table` reach that sheet through its `@source` lines; a number column
 * that renders left-aligned means the sheet lost them.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openDocument,
} from './harness'
import { Parts } from './fixture/static-table-parts'
import { finishMeasurement, measureAnchor } from '../../src/cli/shot/measure'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')

let scratch = ''
let document_ = ''

beforeAll(() => {
  if (!ready) return
  scratch = mkdtempSync(join(tmpdir(), 'static-table-'))
  const cssOut = join(scratch, 'static-table.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [
      cli,
      '--input',
      join(REPO_ROOT, 'packages', 'basalt-ui', 'src', 'css', 'static.css'),
      '--output',
      cssOut,
    ],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`static-table: tailwind failed:\n${css.stderr.toString()}`)
  document_ =
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" /><title>static-table</title>' +
    `<style>${readFileSync(cssOut, 'utf8')}</style></head>` +
    `<body>${renderToString(createElement(Parts))}</body></html>`
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

layout('static table', () => {
  test('a number column is right-aligned and the table is the shipped table', async () => {
    const page = await openDocument(document_, DESKTOP_1440)
    await page.settle()
    const look = await page.raw.evaluate(() => {
      const cell = (selector: string): CSSStyleDeclaration =>
        getComputedStyle(document.querySelector(selector)!)
      return {
        head: cell('thead th:nth-child(2)').textAlign,
        cell: cell('tbody td:nth-child(2)').textAlign,
        textCell: cell('tbody td:nth-child(1)').textAlign,
        spacing: cell('table').borderCollapse,
        caption: cell('caption').captionSide,
      }
    })
    expect(look.head).toBe('right')
    expect(look.cell).toBe('right')
    expect(look.textCell).not.toBe('right')
    expect(look.spacing).toBe('separate')
    expect(look.caption).toBe('bottom')
  })

  for (const viewport of [DESKTOP_1440, PHONE]) {
    test(`the caption covers no row at ${viewport.width}`, async () => {
      const page = await openDocument(document_, viewport)
      await page.settle()
      const handle = await page.raw.$('[data-slot="data-table"]')
      const m = finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
      expect(m.overlaps, 'craft-6/overlap').toEqual([])
    })
  }
})
