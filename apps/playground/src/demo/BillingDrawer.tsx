/**
 * Billing management drawer — playground demo of what a consumer app might build behind
 * `onManageBilling`. Styling is driven entirely by `scenario.plan`/`scenario.planStatus`, so
 * toggling either on `/user` swaps which card renders here. Reads/writes the scenario store
 * directly rather than threading props, matching the store-direct pattern used elsewhere in B4.
 */
import { Alert, Badge, Button, Drawer, Group, Paper, Stack, Text } from '@mantine/core'
import { scenarioToPlan, useUserScenario } from './user-scenario-store'

const FREE_FEATURES = ['1 workspace', 'Community support', 'Core dashboards']

function UpgradeCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>You&apos;re on the Free plan</Text>
          <Badge variant="light">Free</Badge>
        </Group>
        <Stack gap={4}>
          {FREE_FEATURES.map((feature) => (
            <Text key={feature} size="sm" c="dimmed">
              · {feature}
            </Text>
          ))}
        </Stack>
        <Button onClick={onUpgrade}>Upgrade to Pro</Button>
      </Stack>
    </Paper>
  )
}

function CurrentPlanCard({ label, renewsAt }: { label: string; renewsAt: Date | null }) {
  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap={4}>
          <Group justify="space-between">
            <Text fw={600}>{label} plan</Text>
            <Badge variant="light" color="teal">
              Active
            </Badge>
          </Group>
          {renewsAt && (
            <Text size="sm" c="dimmed">
              Renews {renewsAt.toLocaleDateString()}
            </Text>
          )}
        </Stack>
      </Paper>
      <Paper withBorder p="md">
        <Group justify="space-between">
          <Text size="sm">•••• 4242 · Visa</Text>
          <Button size="compact-xs" variant="default">
            Manage payment method
          </Button>
        </Group>
      </Paper>
    </Stack>
  )
}

export function BillingDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [scenario, setScenario] = useUserScenario()
  const plan = scenarioToPlan(scenario)

  const onUpgrade = () => setScenario({ ...scenario, plan: 'pro' })

  const content = (() => {
    if (scenario.plan === 'free') return <UpgradeCard onUpgrade={onUpgrade} />
    if (scenario.planStatus === 'past_due') {
      return (
        <Alert color="yellow" title="Payment failed">
          We couldn&apos;t process your last payment. Update your payment method to keep your plan
          active.
        </Alert>
      )
    }
    if (scenario.planStatus === 'trialing') {
      return (
        <Alert color="blue" title="Trial active">
          Your trial ends soon — add a payment method to keep your plan after it expires.
        </Alert>
      )
    }
    if (scenario.planStatus === 'canceled') {
      return (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Text fw={600} c="dimmed">
              Subscription canceled
            </Text>
            <Text size="sm" c="dimmed">
              Your plan was canceled. Resubscribe any time to regain access.
            </Text>
            <Button variant="default">Resubscribe</Button>
          </Stack>
        </Paper>
      )
    }
    return <CurrentPlanCard label={plan.label} renewsAt={plan.renewsAt ?? null} />
  })()

  return (
    <Drawer opened={opened} onClose={onClose} title="Billing & payment" position="right">
      {content}
    </Drawer>
  )
}
