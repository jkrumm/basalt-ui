import { describe, expect, it } from 'bun:test'
import { MODELS, VIEW, analyse, buildView } from './fixture'

describe('n05 fixture', () => {
  it('has 25 models with unique prices, one of them free', () => {
    expect(MODELS).toHaveLength(25)
    expect(MODELS.filter((m) => m.price === 0)).toHaveLength(1)
  })

  it('names a beater that is cheaper and at least as good for every beaten model', () => {
    for (const m of VIEW.beaten) {
      const beater = MODELS.find((o) => o.name === m.beatenBy?.name)
      expect(beater).toBeDefined()
      expect(beater?.price ?? Infinity).toBeLessThan(m.price)
      expect(beater?.quality ?? 0).toBeGreaterThanOrEqual(m.quality)
      expect(beater?.frontier).toBe(true)
    }
  })

  it('leads with the frontier model the most others are beaten by', () => {
    expect(VIEW.leader?.model.name).toBe('Boreal Large')
    expect(VIEW.leader?.beats).toBe(4)
  })

  it('builds an empty view from no models', () => {
    const view = buildView([])
    expect(view.frontier).toHaveLength(0)
    expect(view.steps).toHaveLength(0)
    expect(view.leader).toBeNull()
    expect(view.breakAt).toBeNull()
  })

  it('builds a one-model view: a lone frontier point, nothing beaten', () => {
    const [only] = MODELS
    const view = buildView(
      only === undefined
        ? []
        : analyse([{ ...only, family: 'Solo', variant: 'Solo', size: null, series: 'other' }]),
    )
    expect(view.frontier).toHaveLength(1)
    expect(view.beaten).toHaveLength(0)
    expect(view.steps).toHaveLength(2)
    expect(view.leader).toBeNull()
  })

  it('rejects two models at one price', () => {
    const [a] = MODELS
    expect(() =>
      analyse(
        a === undefined
          ? []
          : [
              { ...a, family: 'A', variant: 'A', size: null, series: 'other' },
              { ...a, family: 'B', variant: 'B', size: null, series: 'other' },
            ],
      ),
    ).toThrow()
  })
})
