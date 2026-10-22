/**
 * Wave 43: MapLibre's compact attribution inside a flush map card (argo's astro Map tab). The
 * third-party control ships a 12 px radius on both the box and its 24 px button, a 12 px font and a
 * white fill: `craft-1/off-scale-radius`, and at 390 a nested step under 3 px. basalt carries one
 * low-specificity global block that maps it onto the radius scale and the micro text size.
 *
 * basalt does not depend on maplibre-gl, so this injects the DOM and the shipped rules the block
 * competes with (excerpted from maplibre-gl 6.x `dist/maplibre-gl.css`, UNLAYERED like a consumer's
 * import, and appended LAST so source order cannot be what makes it pass).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [{ label: 'Home', items: [{ key: 'home', label: 'Home', active: true }] }],
  cardInset: true,
}

/** `NESTED_MIN_STEP_PX` in `src/cli/shot/detect.ts`. */
const NESTED_MIN_STEP_PX = 3
/** The level-0 radius scale: Mantine's xs/sm/md steps plus the `--vx-radius-*` tiers (px). */
const SCALE = [0, 2, 4, 5, 6, 10, 11, 16, 32]

const MAPLIBRE_EXCERPT = `
.maplibregl-map{font:12px/20px Helvetica Neue,Arial,Helvetica,sans-serif;overflow:hidden;position:relative;height:200px}
.maplibregl-ctrl-bottom-right{position:absolute;pointer-events:none;z-index:2;right:0;bottom:0}
.maplibregl-ctrl{clear:both;pointer-events:auto;transform:translate(0)}
.maplibregl-ctrl.maplibregl-ctrl-attrib{padding:0 5px;background-color:hsla(0,0%,100%,.5);margin:0}
@media screen{
.maplibregl-ctrl-attrib.maplibregl-compact{min-height:20px;padding:2px 24px 2px 0;margin:10px;position:relative;background-color:#fff;color:#000;border-radius:12px;box-sizing:content-box}
.maplibregl-ctrl-attrib.maplibregl-compact-show{padding:2px 28px 2px 8px;visibility:visible}
.maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner{display:none}
.maplibregl-ctrl-attrib-button{display:none;cursor:pointer;position:absolute;background-color:hsla(0,0%,100%,.5);width:24px;height:24px;box-sizing:border-box;border-radius:12px;outline:none;top:0;right:0;border:0}
.maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-button,.maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-inner{display:block}
}
.maplibregl-ctrl-attrib a{color:rgba(0,0,0,.75);text-decoration:none}`

const ATTRIB = '.maplibregl-ctrl-attrib.maplibregl-compact:not(.maplibregl-compact-show)'
const BUTTON = `${ATTRIB} .maplibregl-ctrl-attrib-button`

async function mount(viewport: typeof DESKTOP_1440) {
  const p = await openFixture(SPEC, viewport)
  await p.raw.evaluate(
    ([css]) => {
      const card = document.querySelector('[data-testid="inset-flush"]') as HTMLElement
      card.innerHTML =
        '<div class="maplibregl-map"><div class="maplibregl-ctrl-bottom-right">' +
        '<details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact">' +
        '<summary class="maplibregl-ctrl-attrib-button" aria-label="Toggle attribution"></summary>' +
        '<div class="maplibregl-ctrl-attrib-inner"><a href="#">© MapLibre</a></div>' +
        '</details></div></div>'
      const style = document.createElement('style')
      style.textContent = css
      document.head.append(style)
    },
    [MAPLIBRE_EXCERPT] as const,
  )
  const px = async (selector: string, prop: string): Promise<number> =>
    parseFloat(await p.computed(selector, prop))
  return { p, px }
}

layout('Wave 43 MapLibre compact attribution', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)('%s: the box and its button sit on the radius scale, 3 px apart', async (_, vp) => {
    const { px } = await mount(vp)
    const card = await px('[data-testid="inset-flush"]', 'border-top-left-radius')
    const box = await px(ATTRIB, 'border-top-left-radius')
    const button = await px(BUTTON, 'border-top-left-radius')
    expect(SCALE).toContain(box)
    expect(SCALE).toContain(button)
    expect(card - box).toBeGreaterThanOrEqual(NESTED_MIN_STEP_PX)
    expect(box - button).toBeGreaterThanOrEqual(NESTED_MIN_STEP_PX)
  })

  test('the type size is the micro token', async () => {
    const { p } = await mount(DESKTOP_1440)
    expect(await p.computed(ATTRIB, 'font-size')).toBe('11px')
  })

  test('a consumer rule at (0,3,0) overrides the block', async () => {
    const { p } = await mount(DESKTOP_1440)
    await p.raw.evaluate(() => {
      const style = document.createElement('style')
      style.textContent = '.map-host .maplibregl-ctrl-attrib.maplibregl-compact{border-radius:2px}'
      document.head.append(style)
      document.querySelector('.maplibregl-map')?.classList.add('map-host')
    })
    expect(await p.computed(ATTRIB, 'border-top-left-radius')).toBe('2px')
  })
})
