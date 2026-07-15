/**
 * ActivityPage — a small activity-feed recipe built on Mantine's now-centrally-themed `Timeline`
 * (see `packages/basalt-ui/src/theme/index.ts`'s `Timeline.extend`): the bullet (panel + hairline
 * ring, solid accent when active), the connecting line (`--vx-divider` hairline), and the item
 * title (13px/600 ink) are all themed for free. The only call-site style override is the mono
 * micro-timestamp — docs/DESIGN-SPEC.md §3's micro-label idiom, condensed for a feed row.
 */
import { Paper, Stack, Text, Timeline, Title } from '@mantine/core'
import type { CSSProperties } from 'react'
import { VX } from 'basalt-ui/tokens'

const timestampStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
  // theme-allow: bespoke mono micro-timestamp condensed for a feed row, no matching token
  fontSize: 10.5,
  color: VX.faint,
}

type ActivityEvent = { id: string; title: string; timestamp: string; description: string }

const ACTIVITY_EVENTS: ActivityEvent[] = [
  {
    id: 'deploy',
    title: 'Deployment shipped to production',
    timestamp: 'Just now',
    description: 'v2.4.0 rolled out to all regions with zero downtime.',
  },
  {
    id: 'signup',
    title: 'New signup: Clara Bauer',
    timestamp: '12 min ago',
    description: 'Joined via the referral program.',
  },
  {
    id: 'payment',
    title: 'Payment received',
    timestamp: '1 hour ago',
    description: '$1,240 invoice settled for the Pro plan.',
  },
  {
    id: 'ticket',
    title: 'Support ticket resolved',
    timestamp: '3 hours ago',
    description: 'Ticket #4821 closed — billing question.',
  },
  {
    id: 'digest',
    title: 'Weekly digest sent',
    timestamp: 'Yesterday',
    description: '2,481 recipients, 34% open rate.',
  },
  {
    id: 'team',
    title: 'Team member added',
    timestamp: '2 days ago',
    description: 'Frank Weber joined the Design workspace.',
  },
]

export function ActivityPage() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Activity</Title>
        <Text size="sm" c="dimmed" mt={4}>
          A recent-events feed built on Mantine's Timeline — themed centrally (bullet, line, and
          title); only the timestamp is a call-site style override.
        </Text>
      </div>

      <Paper py="xs" px="sm">
        <Timeline active={0}>
          {ACTIVITY_EVENTS.map((event) => (
            <Timeline.Item key={event.id} title={event.title}>
              <Text style={timestampStyle}>{event.timestamp}</Text>
              <Text size="sm" c="dimmed" mt={2}>
                {event.description}
              </Text>
            </Timeline.Item>
          ))}
        </Timeline>
      </Paper>
    </Stack>
  )
}
