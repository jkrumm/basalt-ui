import { useFormat } from '../core/format'
import { lists } from '../core/messages/lists'
import { useMessages } from '../core/messages/use-messages'
import type { Period } from './event-list-model'

/**
 * The heading of a calendar period, one wording for every day-grouped list (`EventList`,
 * `MailList`): Today, Yesterday, This week, Earlier this month, a month by name, a year by number.
 * `day` is a moment inside the period, for the month's name. Internal.
 */
export function usePeriodLabel(): (period: Period, day: Date) => string {
  const t = useMessages(lists)
  const f = useFormat()
  return (period, day) => {
    switch (period.kind) {
      case 'today':
        return t('lists.today')
      case 'yesterday':
        return t('lists.yesterday')
      case 'week':
        return t('lists.thisWeek')
      case 'month':
        return t('lists.earlierThisMonth')
      case 'monthOf':
        return f.date(day, 'month', { year: undefined })
      case 'year':
        return String(period.year)
    }
  }
}
