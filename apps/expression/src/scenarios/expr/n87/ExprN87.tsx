import { useState } from 'react'
import type { ReactElement } from 'react'
import { useFormat } from 'basalt-ui'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Page, PageBar, PageSummary } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Skeleton } from 'basalt-ui/ui/skeleton'
import { Archive, CloudUpload, FileWarning, Trash2 } from 'lucide-react'
import type { ScenarioProps } from '../../shot-state'
import { libraryFor, RETENTION_DAYS, unsyncedFinals } from './fixture'
import type { SyncTarget } from './fixture'
import { WaitingPanel } from './WaitingPanel'

type Source = 'library' | 'sync' | 'archive' | 'housekeeping'

const FAILURE: Record<Source, string> = {
  library: 'The library index could not be read.',
  sync: 'The sync service is not responding.',
  archive: 'The raw archive check failed.',
  housekeeping: 'The scan of old entries failed.',
}

export function ExprN87Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const [retried, setRetried] = useState<readonly Source[]>([])
  // The empty frame is the fresh library: every count a measured zero.
  const lib = libraryFor(shotState === 'empty' ? 'fresh' : fixture)

  // Each source keeps its own retry, built once so the frames of one source draw one Retry.
  const again = (source: Source) => () => setRetried((done) => [...done, source])
  const RETRY: Record<Source, () => void> = {
    library: again('library'),
    sync: again('sync'),
    archive: again('archive'),
    housekeeping: again('housekeeping'),
  }
  const phaseOf = (source: Source): Phase => {
    if (shotState === 'loading') return 'loading'
    if (shotState !== 'error' || retried.includes(source)) return 'ready'
    return {
      tag: 'error',
      message: FAILURE[source],
      retry: RETRY[source],
    }
  }

  const libraryPhase = phaseOf('library')
  const photos = lib.finals + lib.staging
  const unsynced = unsyncedFinals(lib)
  const trash = lib.waiting.filter((w) => w.kind === 'trash')
  const listed = lib.waiting.length - trash.length
  const oldestTrash = Math.max(0, ...trash.map((w) => w.days ?? 0))

  const targetRow = (t: SyncTarget) =>
    t.unsynced === 0
      ? { label: t.name, value: 'In sync' }
      : { label: `${t.name}, oldest`, value: `${t.oldestDays} days` }

  const size = (bytes: number) =>
    f.number(bytes >= 1e9 ? bytes / 1e9 : bytes / 1e6, {
      style: 'unit',
      unit: bytes >= 1e9 ? 'gigabyte' : 'megabyte',
      maximumFractionDigits: 1,
    })

  const archive = lib.archive
  const orphans =
    archive.state === 'ready'
      ? {
          value: archive.orphaned,
          status:
            archive.orphaned === 0
              ? { tone: 'neutral' as const, label: 'No orphans' }
              : { tone: 'warn' as const, label: 'Orphans found' },
        }
      : archive.state === 'unavailable'
        ? {
            value: null,
            status: { tone: 'neutral' as const, label: 'Not measured' },
            sub: 'Archive offline',
          }
        : {
            value: null,
            status: { tone: 'neutral' as const, label: 'Not measured' },
            sub: 'Still counting',
          }

  const emptyCause =
    photos === 0
      ? 'A new collection holds none yet. Import a card to start.'
      : 'Nothing is expired and every file reads. No action needed.'

  return (
    <Page area="photo-library">
      <PageBar title="Photo library" />
      <PageSummary
        sentence={
          libraryPhase === 'ready' ? (
            `${f.number(photos)} photos, ${f.number(lib.staging)} in staging`
          ) : libraryPhase === 'loading' ? (
            // cycle-expression-18: the loading summary skeleton is four bars at 390, a line and a half taller than the loaded one, so a one-line skeleton stands in
            <span className="block text-lg">
              <Skeleton className="w-64" />
            </span>
          ) : (
            'Could not load the library'
          )
        }
        // cycle-expression-18: a summary fact takes a node, so it cannot be set in the mono face a time wants
        facts={[
          libraryPhase === 'ready' ? (
            `Last reindex ${lib.reindexedAt === undefined ? 'never' : f.dateTime(lib.reindexedAt, 'short')}`
          ) : libraryPhase === 'loading' ? (
            <span key="fact" className="block text-xs">
              <Skeleton className="w-40" />
            </span>
          ) : (
            FAILURE.library
          ),
        ]}
        // cycle-expression-18: the summary's error phase draws an empty band with no cause or Retry, so the failure is its own sentence with the Retry in the aside
        aside={
          typeof libraryPhase === 'object' ? (
            <Button variant="secondary" size="sm" onClick={RETRY.library}>
              Retry
            </Button>
          ) : undefined
        }
      />
      <StatGroup variant="cards" label="Before wiping the card">
        <StatCell
          icon={CloudUpload}
          title="Unsynced finals"
          info="Photos missing from a sync target. Zero is safe to wipe."
          value={unsynced}
          status={
            unsynced === 0
              ? { tone: 'neutral', label: 'Safe to wipe' }
              : { tone: 'warn', label: 'Not safe to wipe' }
          }
          meter={{
            label: 'Backed up',
            value: lib.finals - unsynced,
            max: Math.max(lib.finals, 1),
            format: (v) => `${f.number(v)} of ${f.number(lib.finals)} backed up`,
          }}
          rows={[targetRow(lib.targets[0]), targetRow(lib.targets[1])]}
          phase={phaseOf('sync')}
        />
        <StatCell
          icon={Archive}
          title="Orphaned raws"
          info="Raw files that match no final. Any above zero is a leftover."
          value={orphans.value}
          status={orphans.status}
          sub={archive.state === 'ready' ? undefined : orphans.sub}
          rows={
            archive.state === 'ready' ? [{ label: 'Size', value: size(archive.bytes) }] : undefined
          }
          phase={phaseOf('archive')}
        />
        <StatCell
          icon={Trash2}
          title="Expired trash"
          info="Entries kept longer than the retention. Emptying them brings it to zero."
          value={trash.length}
          status={
            trash.length === 0
              ? { tone: 'neutral', label: 'Nothing to empty' }
              : { tone: 'warn', label: 'Ready to empty' }
          }
          rows={[{ label: 'Retention', value: `${RETENTION_DAYS} days` }]}
          phase={phaseOf('housekeeping')}
        />
        <StatCell
          icon={FileWarning}
          title="Sidecar errors"
          info="Files that cannot be read, counted in full, while the table lists only some."
          value={lib.unreadable}
          status={
            lib.unreadable === 0
              ? { tone: 'neutral', label: 'All readable' }
              : { tone: 'warn', label: 'Need repair' }
          }
          meter={{
            label: 'Listed',
            value: listed,
            max: Math.max(lib.unreadable, 1),
            format: (v) => `${f.number(v)} of ${f.number(lib.unreadable)} listed`,
          }}
          phase={phaseOf('housekeeping')}
        />
      </StatGroup>
      <WaitingPanel
        rows={lib.waiting}
        oldest={oldestTrash}
        phase={phaseOf('housekeeping')}
        cause={emptyCause}
      />
    </Page>
  )
}
