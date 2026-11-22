/**
 * What an active filter reads as, in a chip and in the header's filter mark (docs/v3/concepts/
 * data-table.md section 3): `Name contains Ac`, `State is Open, Done`, `Amount 10 – 500`,
 * `Date from 1 Oct 2026`. One function, so the toolbar, the sheet and the header say the same.
 */
import { useFormat } from '../../core/format'
import type { CalendarDate, Format } from '../../core/format'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { FilterModel } from '../contract'
import { numberOf, rangeEnds } from '../core/filters'
import { isDayKind } from '../core/kinds-spec'
import type { KindSpec } from '../core/kinds-spec'

/** A filter as words: the operator (`contains`, `is`; none for a range) and the value. */
export type FilterText = { op: string | null; value: string }

type Spec = Pick<KindSpec<never>, 'kind' | 'labels' | 'unit'>

/** One end of a range as the column prints it: a day, an amount in the currency, a number. */
function endText(spec: Spec, text: string, format: Format): string {
  if (isDayKind(spec.kind)) {
    return format.date(text as CalendarDate, 'short')
  }
  const value = numberOf(text)
  if (value === null) return text
  return spec.kind === 'money' && spec.unit !== undefined
    ? format.money(value, spec.unit)
    : format.number(value)
}

/** The words of one filter on one column. */
export function useFilterText(): (spec: Spec | undefined, filter: FilterModel) => FilterText {
  const t = useMessages(table)
  const format = useFormat()
  return (spec, filter) => {
    if (filter.op === 'range' && spec !== undefined) {
      const [from, to] = rangeEnds(filter.values)
      const day = isDayKind(spec.kind)
      const a = from === '' ? '' : endText(spec, from, format)
      const b = to === '' ? '' : endText(spec, to, format)
      const value =
        a !== '' && b !== ''
          ? from === to
            ? a
            : t('table.rangeBetween', a, b)
          : a !== ''
            ? t(day ? 'table.dayFrom' : 'table.rangeFrom', a)
            : t(day ? 'table.dayTo' : 'table.rangeTo', b)
      return { op: null, value }
    }
    return {
      op: filter.op === 'anyOf' ? t('table.opAnyOf') : t('table.opContains'),
      value: filter.values.map((v) => spec?.labels?.[v] ?? v).join(', '),
    }
  }
}
