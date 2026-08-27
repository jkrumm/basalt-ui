import { createFileRoute } from '@tanstack/react-router'
import { dashboardFilters } from '../../demo/dashboard-range-store'
import { CHANNEL_MIX } from '../../demo/data'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/traffic')({
  staticData: { title: 'Traffic' },
  component: TrafficPage,
})

const totalChannelVolume = CHANNEL_MIX.reduce((sum, channel) => sum + channel.value, 0)
const topChannel = CHANNEL_MIX.reduce((top, channel) => (channel.value > top.value ? channel : top))

function TrafficPage() {
  const [range] = dashboardFilters.field.range.use()
  return (
    <SubPage
      title="Traffic"
      description="Traffic sources and channel breakdown — direct, organic, referral, social, and paid."
      range={dashboardFilters.field.range.options.find((o) => o.value === range.preset)?.label}
      stats={[
        {
          key: 'total',
          title: 'Total sessions',
          value: totalChannelVolume.toLocaleString('en-US'),
        },
        {
          key: 'top',
          title: `Top channel — ${topChannel.label}`,
          value: `${Math.round((topChannel.value / totalChannelVolume) * 100)}%`,
        },
      ]}
    />
  )
}
