import type { Format } from 'basalt-ui'
import type { ChartFigure } from 'basalt-ui/charts'
import type { FootFacts, Tone } from 'basalt-ui/cards'
import { MODELS, MODEL_NAME } from './fixture'
import { gapAt, type Forecast, type Hour, type Night } from './frost'
import { dayMonth, degrees, gapText, moment } from './text'

/** What the card's figure and footer say: at rest, for one hour, or for one night. */
export type Readout = { figure: ChartFigure; footer: FootFacts }

const frostTone = (frost: boolean): Tone => (frost ? 'warn' : 'neutral')

/**
 * The slots a frame holds before its data is ready: the frame draws them as a skeleton.
 * cycle-expression-10: a frame needs every slot declared to hold its height, so the held slots carry empty values (an error still prints a dash for each).
 */
export const HELD: Readout = {
  figure: {
    value: null,
    unit: 'nights freeze',
    delta: { value: '', polarity: 'neutral' },
    status: { tone: 'neutral', label: '' },
    period: '',
  },
  footer: [
    { label: 'Coldest hour', value: '' },
    { label: 'Dew point then', value: '' },
  ],
}

const meanGap = (hours: readonly Hour[], model: (typeof MODELS)[number]): number =>
  hours.reduce((sum, h) => sum + gapAt(h, model), 0) / Math.max(1, hours.length)

function gapDelta(f: Format, fc: Forecast, hours: readonly Hour[]): ChartFigure['delta'] {
  return {
    value: gapText(f, meanGap(hours, fc.outlier.model)),
    polarity: 'neutral',
    label: MODEL_NAME[fc.outlier.model],
  }
}

/** The coldest hour of a night and the dew point then: the two facts the footer keeps. */
function coldestFacts(f: Format, night: Night): FootFacts {
  return [
    { label: 'Coldest hour', value: moment(f, night.lowestAt), mono: true },
    { label: 'Dew point then', value: `${degrees(f, night.dewAtLowest)} °C` },
  ]
}

export function restReadout(fc: Forecast, f: Format): Readout {
  const { nights, longest, coldest } = fc
  const first = fc.hours[0]
  const last = fc.hours.at(-1)
  if (coldest === undefined || first === undefined || last === undefined) return HELD
  return {
    figure: {
      value: fc.frostNights.length,
      unit: `of ${nights.length} nights freeze`,
      delta: gapDelta(f, fc, fc.hours),
      status:
        longest === undefined
          ? { tone: 'neutral', label: `Lowest ${degrees(f, coldest.lowest)} °C` }
          : { tone: 'warn', label: `Longest ${longest.day}, ${longest.frostHours} h` },
      period: `${f.date(first.at, 'short', { year: undefined, month: undefined })} to ${dayMonth(f, last.at)}`,
      periodMono: true,
    },
    footer: coldestFacts(f, coldest),
  }
}

export function hourReadout(hour: Hour, fc: Forecast, f: Format): Readout {
  const temps = MODELS.map((m) => hour.temp[m])
  return {
    figure: {
      value: degrees(f, hour.median),
      unit: '°C median',
      delta: gapDelta(f, fc, [hour]),
      status: { tone: frostTone(hour.below >= 2), label: `${hour.below} of 3 models below 0 °C` },
      period: moment(f, hour.at),
      periodMono: true,
    },
    footer: [
      { label: 'Dew point', value: `${degrees(f, hour.dewMedian)} °C` },
      {
        label: 'Models range',
        value: `${degrees(f, Math.min(...temps))} to ${degrees(f, Math.max(...temps))} °C`,
      },
    ],
  }
}

export function nightReadout(night: Night, fc: Forecast, f: Format): Readout {
  return {
    figure: {
      value: night.frostHours,
      unit: 'h below 0 °C',
      delta: gapDelta(f, fc, night.hours),
      status: {
        tone: frostTone(night.frostHours > 0),
        label: `${night.models} of 3 models below 0 °C`,
      },
      period: night.name,
    },
    footer: coldestFacts(f, night),
  }
}
