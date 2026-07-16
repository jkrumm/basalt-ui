import { createFileRoute, useSearch } from '@tanstack/react-router'
import { CHANNEL_MIX } from '../../demo/data'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/traffic')({
  staticData: { title: 'Traffic' },
  component: TrafficPage,
})

const RANGE_LABEL: Record<string, string> = { '1d': 'Last 24h', '7d': 'Last 7d', '30d': 'Last 30d' }

const totalChannelVolume = CHANNEL_MIX.reduce((sum, channel) => sum + channel.value, 0)
const topChannel = CHANNEL_MIX.reduce((top, channel) => (channel.value > top.value ? channel : top))

function TrafficPage() {
  const { range } = useSearch({ from: '/dashboard' })
  return (
    <SubPage
      title="Traffic"
      description="Traffic sources and channel breakdown — direct, organic, referral, social, and paid."
      range={RANGE_LABEL[range]}
      stats={[
        {
          key: 'total',
          label: 'Total sessions',
          value: totalChannelVolume.toLocaleString('en-US'),
        },
        {
          key: 'top',
          label: `Top channel — ${topChannel.label}`,
          value: `${Math.round((topChannel.value / totalChannelVolume) * 100)}%`,
        },
      ]}
    />
  )
}
