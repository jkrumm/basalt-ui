import { carried } from './define'

/** `x.domain`: charts given one domain put one instant on one pixel column. Carried by `toEngineSpec` (`xDomain`). */
export const xDomain = carried({
  id: 'x.domain',
  consumer:
    'linewatch web/src/charts/bufferbloat-chart.tsx:90,118, the slot extent of the window is the x domain of every chart on the page',
})
