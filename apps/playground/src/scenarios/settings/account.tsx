/**
 * S6 part (a): the account settings page (the shape of a desktop app's settings): profile,
 * notifications, API keys and a danger zone on `SettingsSection`/`SettingsRow`/`DangerZone`.
 */
import { Button, Select, Skeleton, Stack, Switch, TextInput } from '@mantine/core'
import { DangerZone, EmptyState, Section, SettingsRow, SettingsSection } from 'basalt-ui'
import { noop, queryFor, retryCopy } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { API_KEYS, DIGEST_OPTIONS } from './settings-data'

const ACCOUNT_ERROR = queryFor('error', retryCopy('account'))

/** Each section keeps its loaded shape: a title row, then label/control rows. */
function AccountSkeleton() {
  return (
    <Stack gap="sm" aria-busy="true">
      {[2, 2, 3].map((rows, s) => (
        <SettingsSection key={s} title="Loading">
          {Array.from({ length: rows }, (_, i) => (
            <SettingsRow
              key={i}
              label=""
              control={<Skeleton height={32} width={200} radius="md" />}
            >
              <Skeleton height={32} width={200} radius="md" />
            </SettingsRow>
          ))}
        </SettingsSection>
      ))}
    </Stack>
  )
}

function KeyRows({ empty }: { empty: boolean }) {
  if (empty) {
    return (
      <EmptyState
        tier="section"
        title="No API keys yet"
        description="Create a key to use the CLI or a deploy script."
        action={
          <Button size="xs" onClick={noop}>
            Create key
          </Button>
        }
      />
    )
  }
  return (
    <>
      {API_KEYS.map((k) => (
        <SettingsRow
          key={k.id}
          label={k.name}
          description={`…${k.tail} · ${k.lastUsed}`}
          control={
            <Button size="xs" variant="default" onClick={noop}>
              Revoke
            </Button>
          }
        />
      ))}
    </>
  )
}

export function AccountSettings({ shotState }: ScenarioProps) {
  if (shotState === 'loading') return <AccountSkeleton />
  if (shotState === 'error') {
    return (
      <Section title="Account" {...(ACCOUNT_ERROR && { query: ACCOUNT_ERROR })}>
        {null}
      </Section>
    )
  }
  return (
    <Stack gap="sm">
      <SettingsSection title="Profile" subtitle="Shown to the people you share with.">
        <SettingsRow
          label="Display name"
          control={<TextInput aria-label="Display name" defaultValue="Mara Lindqvist" />}
        />
        <SettingsRow
          label="Email"
          description="Used for sign-in and receipts."
          control={<TextInput aria-label="Email" type="email" defaultValue="mara@example.com" />}
        />
      </SettingsSection>
      <SettingsSection title="Notifications">
        <SettingsRow
          label="Sync failures"
          description="Email me when a sync stops."
          control={<Switch aria-label="Sync failures" defaultChecked />}
        />
        <SettingsRow
          label="Activity digest"
          control={
            <Select
              aria-label="Activity digest"
              data={[...DIGEST_OPTIONS]}
              defaultValue="weekly"
              allowDeselect={false}
            />
          }
        />
      </SettingsSection>
      <SettingsSection
        title="API keys"
        actions={
          shotState === 'empty' ? undefined : (
            <Button variant="default" onClick={noop}>
              Create key
            </Button>
          )
        }
      >
        <KeyRows empty={shotState === 'empty'} />
      </SettingsSection>
      <DangerZone
        title="Delete account"
        subtitle="Removes your data for good. This cannot be undone."
      >
        <SettingsRow
          label="Delete this account"
          control={
            <Button color="red" variant="outline" size="xs" onClick={noop}>
              Delete
            </Button>
          }
        />
      </DangerZone>
    </Stack>
  )
}
