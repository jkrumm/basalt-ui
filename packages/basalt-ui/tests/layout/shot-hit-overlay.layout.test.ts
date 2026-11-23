/**
 * `shot detect`'s hit floor reads a control's target as its box unioned with the invisible `::after`
 * overlay the parts draw (checkbox, radio, switch, stepper), so a 16 px box with a 24 px overlay is clean
 * and a 20 px control with none, with the overlay hidden, or with one anchored to an ancestor is `craft-6/hit-floor`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { CLOSE_BUDGET_MS, closeLayoutSuite, initLayoutSuite, openDocument } from './harness'
import type { Viewport } from './harness'
import { finishMeasurement, measureAnchor } from '../../src/cli/shot/measure'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const DESKTOP: Viewport = { name: 'shot 1800', width: 1800, height: 1200 }

const HTML = `<!doctype html><meta charset="utf-8"><style>
  .box { display: inline-flex; width: 16px; height: 16px; position: relative; }
  .box.hit::after { content: ''; position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; translate: -50% -50%; }
  .box.hidden::after { content: ''; display: none; }
  .bar { display: block; width: 100px; height: 20px; }
  .far { display: block; width: 20px; height: 20px; }
  .far::after { content: ''; position: absolute; width: 200px; height: 200px; }
</style>
<div id="root">
  <span role="checkbox" aria-label="a" class="box hit"></span>
  <span role="checkbox" aria-label="b" class="box"></span>
  <button class="box hidden" aria-label="c"></button>
  <button class="bar" aria-label="d"></button>
  <button class="far" aria-label="e"></button>
</div>`

layout('the hit floor of the in-page measurer', () => {
  test('counts the ::after overlay of a control, never a hidden one', async () => {
    const page = await openDocument(HTML, DESKTOP)
    const handle = await page.raw.$('#root')
    const m = finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
    expect((m.small ?? []).map((s) => s.replace(/^.*> /, ''))).toEqual([
      'span.box 16x16',
      'button.box 16x16',
      'button.bar 100x20',
      'button.far 20x20',
    ])
  })
})

const CLIPPED = `<!doctype html><meta charset="utf-8"><style>
  #root { position: relative; width: 400px; height: 60px; font: 14px/20px sans-serif; }
  .clip { position: absolute; left: 0; top: 0; width: 100px; height: 20px; overflow: hidden; white-space: nowrap; }
  .ell { position: absolute; left: 0; top: 30px; width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .next { position: absolute; white-space: nowrap; }
  .a { position: absolute; left: 0; top: 50px; white-space: nowrap; }
  .b { position: absolute; left: 10px; top: 50px; white-space: nowrap; }
</style>
<div id="root">
  <div class="clip"><span>a very long label that runs well past the clipping box</span></div>
  <span class="next" style="left: 150px; top: 0">next</span>
  <div class="ell">an ellipsised label that is cut to a short box by its own text-overflow</div>
  <span class="next" style="left: 80px; top: 30px">beside</span>
  <span class="a">aaa</span><span class="b">bbb</span>
</div>`

layout('the text boxes the overlap measurer reads', () => {
  test('text a clipping ancestor or an ellipsis hides is no overlap; text both shown is', async () => {
    const page = await openDocument(CLIPPED, DESKTOP)
    const handle = await page.raw.$('#root')
    const m = finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
    expect(m.overlaps ?? []).toHaveLength(1)
    expect(m.overlaps?.[0]).toContain('span.a')
    expect(m.overlaps?.[0]).toContain('span.b')
  })
})

const ESCAPES =
  '<!doctype html><meta charset="utf-8"><style>\n  #root { position: relative; width: 400px; height: 40px; font: 14px/20px sans-serif; }\n  .card { position: static; overflow: hidden; width: 100px; height: 20px; white-space: nowrap; }\n  .esc { position: absolute; left: 110px; top: 0; white-space: nowrap; }\n  .outside { position: absolute; left: 150px; top: 0; white-space: nowrap; }\n</style>\n<div id="root">\n  <div class="card"><span>card label</span><span class="esc">escapes</span></div>\n  <span class="outside">outside</span>\n</div>'

layout('an absolute box is cut only by the overflow of its containing block', () => {
  test('a box escaping a clipping card still overlaps the text beside it', async () => {
    const page = await openDocument(ESCAPES, DESKTOP)
    const handle = await page.raw.$('#root')
    const m = finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
    expect(m.overlaps ?? []).toHaveLength(1)
    expect(m.overlaps?.[0]).toContain('span.esc')
    expect(m.overlaps?.[0]).toContain('span.outside')
  })
})

const FIXED =
  '<!doctype html><meta charset="utf-8"><style>\n  #root { position: relative; width: 400px; height: 40px; font: 14px/20px sans-serif; }\n  .card { position: static; overflow: hidden; width: 100px; height: 20px; white-space: nowrap; }\n  .fix { position: fixed; left: 150px; top: 0; white-space: nowrap; }\n  .outside { position: absolute; left: 150px; top: 0; white-space: nowrap; }\n</style>\n<div id="root">\n  <div class="card"><span>card label</span><span class="fix">fixed</span></div>\n  <span class="outside">outside</span>\n</div>'

layout('a fixed box is cut by no overflow ancestor', () => {
  test('a fixed box escaping a clipping card still overlaps the text beside it', async () => {
    const page = await openDocument(FIXED, DESKTOP)
    const handle = await page.raw.$('#root')
    const m = finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
    expect(m.overlaps ?? []).toHaveLength(1)
    expect(m.overlaps?.[0]).toContain('span.fix')
    expect(m.overlaps?.[0]).toContain('span.outside')
  })
})

const AXES =
  '<!doctype html><meta charset="utf-8"><style>\n  #root { position: relative; width: 400px; height: 60px; font: 14px/20px sans-serif; }\n  .col { position: absolute; left: 0; top: 0; width: 100px; height: 20px; overflow-x: clip; overflow-y: visible; white-space: nowrap; }\n  .nb { position: absolute; left: 10px; top: 25px; white-space: nowrap; }\n</style>\n<div id="root">\n  <div class="col"><span class="down" style="position: relative; top: 20px">below</span></div>\n  <span class="nb">near</span>\n</div>'
const CONTENTS =
  '<!doctype html><meta charset="utf-8"><style>\n  #root { position: relative; width: 400px; height: 40px; font: 14px/20px sans-serif; }\n  .b { position: absolute; left: 10px; top: 0; white-space: nowrap; }\n</style>\n<div id="root">\n  <div class="dc" style="display: contents; overflow: hidden"><span class="a">aaa</span></div>\n  <span class="b">bbb</span>\n</div>'

layout('the clip reads each axis on its own and skips display: contents', () => {
  test('overflow-x: clip leaves the text below its box in y to overlap', async () => {
    const page = await openDocument(AXES, DESKTOP)
    const handle = await page.raw.$('#root')
    const m = finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
    expect(m.overlaps ?? []).toHaveLength(1)
    expect(m.overlaps?.[0]).toContain('span.down')
    expect(m.overlaps?.[0]).toContain('span.nb')
  })
  test('a display: contents wrapper with overflow hidden does not hide its text', async () => {
    const page = await openDocument(CONTENTS, DESKTOP)
    const handle = await page.raw.$('#root')
    const m = finishMeasurement(await page.raw.evaluate(measureAnchor, handle as never))
    expect(m.overlaps ?? []).toHaveLength(1)
    expect(m.overlaps?.[0]).toContain('span.a')
    expect(m.overlaps?.[0]).toContain('span.b')
  })
})
