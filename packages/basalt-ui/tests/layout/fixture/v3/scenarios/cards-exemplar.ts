/**
 * The StatCard exemplar scenario's declaration: pure data, so the test process can import the registry.
 *
 * It provides the card slots and matches its own `cardsExemplar` field. The render lives in
 * `cards-exemplar-mount.tsx`, loaded on mount.
 */
import type { Scenario } from '../registry'

export const cardsExemplarScenario: Scenario = {
  slots: ['card', 'card-band', 'stat-figure', 'stat-sub', 'stat-chart', 'stat-controls'],
  matches: (spec) => spec.cardsExemplar === true,
  async mount(spec, container) {
    const { mount } = await import('./cards-exemplar-mount')
    await mount(spec, container)
  },
}
