/**
 * S6 part (a): the account settings page (the shape of a desktop app's settings): profile,
 * notifications, API keys and a danger zone on `SettingsSection`/`SettingsRow`/`DangerZone`.
 */
import { Button, Card, Flex, Select, Skeleton, Stack, Switch, TextInput } from '@mantine/core'
import { DangerZone, EmptyState, Section, SettingsRow, SettingsSection } from 'basalt-ui'
import { noop, queryFor, retryCopy } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { API_KEYS, DIGEST_OPTIONS } from './settings-data'

const ACCOUNT_ERROR = queryFor('error', retryCopy('account'))

/**
 * The four sections in grey: a title and a subtitle line per card, then label/control rows at the
 * loaded heights (a description makes a row taller; the key rows carry one).
 */
const SKELETON_SECTIONS: { subtitle: boolean; danger?: boolean; rows: boolean[] }[] = [
  { subtitle: true, rows: [false, true] },
  { subtitle: false, rows: [true, false] },
  { subtitle: false, rows: [true, true, true] },
  { subtitle: true, danger: true, rows: [false] },
]

function AccountSkeleton() {
  return (
    <Stack gap="sm" aria-busy="true">
      {SKELETON_SECTIONS.map((section, s) => (
        <Card key={s}>
          <Stack gap={2} mb="sm" mih={section.subtitle ? 61 : 41}>
            {section.danger && <Skeleton height={14} width={88} radius="sm" />}
            <Skeleton height={20} width={120} radius="sm" />
            {section.subtitle && <Skeleton height={14} width="38%" radius="sm" />}
          </Stack>
          {section.rows.map((described, i) => (
            <Flex
              key={i}
              columnGap="md"
              rowGap={4}
              wrap="wrap"
              py={10}
              align="flex-start"
              mih={described ? 61 : 53}
              style={
                i < section.rows.length - 1 ? { borderBottom: '1px solid var(--vx-divider)' } : {}
              }
            >
              <Stack gap={4} w="min(15rem, 100%)">
                <Skeleton height={20} width="60%" radius="sm" />
                {described && <Skeleton height={16} width="80%" radius="sm" />}
              </Stack>
              <Skeleton height={32} width={i === 0 ? 'min(20rem, 100%)' : '4.5rem'} radius="md" />
            </Flex>
          ))}
        </Card>
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
            <Button size="xs" variant="default" aria-label={`Revoke ${k.name}`} onClick={noop}>
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
    // § 6.11: the error anatomy inside the section surface it replaces, with that surface's inset.
    return (
      <Card>
        {ACCOUNT_ERROR && (
          <Section title="Account" query={ACCOUNT_ERROR}>
            {null}
          </Section>
        )}
      </Card>
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
            <Button
              color="red"
              variant="outline"
              size="xs"
              aria-label="Delete this account"
              onClick={noop}
            >
              Delete
            </Button>
          }
        />
      </DangerZone>
    </Stack>
  )
}
