/**
 * The manage-view panel: everything a saved view owns, edited in one place while the table follows.
 * A root of four groups of rows (label, current value, chevron) drills into one page per property,
 * with Back. Each edit writes the table at once, so the view reads modified until Save; what is not
 * table state (the name, the sharing, the default) writes the store at once.
 *
 * It is a `Dock` from the `regular` size class up (non-modal, resizable, beside main under a shell,
 * so the table stays in view and usable) and a bottom `Sheet` on a phone. It never takes the page's
 * `PageAside`, which is the detail host a row opens into.
 */
import { useId, useState } from 'react'
import type { FormEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Dock } from '../../page/dock'
import { useSizeClass } from '../../page/use-size-class'
import { Button, Pressable } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Input } from '../../ui/input'
import { RadioGroup } from '../../ui/radio-group'
import { Sheet, SheetContent } from '../../ui/sheet'
import type { RowHeight } from '../contract'
import type { KindSpec } from '../core/kinds-spec'
import { clampWidth, widthPx } from '../core/plan'
import type { TableModel } from '../use-data-table'
import { useFilterText } from './filter-text'
import { OrderList } from './order-list'
import { FilterEditor } from './toolbar-editor'
import { activeFilters, filterableSpecs } from './toolbar-filters'
import type { FilterableSpec } from './toolbar-filters'
import { parentPage } from './view-door'
import type { PanelPage } from './view-door'
import type { ViewsController } from './views'

type Preset = 'compact' | 'default' | 'wide'
const PRESET_SCALE: Record<Exclude<Preset, 'default'>, number> = { compact: 0.8, wide: 1.25 }

/** The widths a preset writes: each resizable column's own width scaled, inside its bounds. */
function presetWidths<T>(
  model: TableModel<T>,
  preset: Exclude<Preset, 'default'>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const spec of model.specs) {
    if (!model.resizable(spec.id)) continue
    // The kind's own width, never the drawn one: a stored width is what a preset replaces.
    out[spec.id] = clampWidth(spec.kind, Math.round(widthPx(spec.width) * PRESET_SCALE[preset]))
  }
  return out
}

const sameWidths = (a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([id, px]) => b[id] === px)

function Glyph({ d, className }: { d: string; className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-icon shrink-0', className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const CHEVRON = 'm6 3.5 4.5 4.5L6 12.5'
const BACK = 'M10 3.5 5.5 8l4.5 4.5'
const LOCK = 'M4.5 7.5h7v5.5h-7zM6 7.5V5.5a2 2 0 0 1 4 0v2'

/** A bordered group of rows, as the root lays them out. */
function Group({ children }: { children: ReactNode }): ReactElement {
  return (
    <ul
      data-slot="table-view-group"
      className="m-0 flex list-none flex-col divide-y divide-border overflow-hidden rounded-card border border-border p-0"
    >
      {children}
    </ul>
  )
}

/** One root row: the label, the current value in muted ink, and a chevron when it opens a page. */
function Row({
  label,
  value,
  onClick,
  opens = true,
  danger = false,
  disabled = false,
}: {
  label: string
  value?: string | undefined
  onClick: () => void
  opens?: boolean
  danger?: boolean
  disabled?: boolean
}): ReactElement {
  return (
    <li>
      <Pressable
        size="row"
        data-slot="table-view-row"
        disabled={disabled}
        onClick={onClick}
        className="w-full px-3 text-start text-sm hover:bg-accent data-disabled:opacity-50"
      >
        <span className={cn('min-w-0 flex-1 truncate', danger && 'text-bad')}>{label}</span>
        {value !== undefined && (
          <span className="max-w-[50%] truncate text-muted-foreground">{value}</span>
        )}
        {opens && <Glyph d={CHEVRON} className="text-muted-foreground" />}
      </Pressable>
    </li>
  )
}

function Back({ onClick }: { onClick: () => void }): ReactElement {
  const t = useMessages(table)
  return (
    <Button variant="ghost" size="sm" className="self-start" onClick={onClick}>
      <Glyph d={BACK} />
      {t('table.panelBack')}
    </Button>
  )
}

/** Save and Discard while the table differs from the view it shows. */
function Pending<T>({ c }: { c: ViewsController<T> }): ReactElement | null {
  const t = useMessages(table)
  if (!c.modified) return null
  return (
    <div
      data-slot="table-view-panel-pending"
      className="flex items-center gap-2 rounded-card border border-border px-3 py-2"
    >
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
        {t('table.panelPending')}
      </span>
      <Button variant="ghost" size="sm" onClick={c.discard}>
        {t('table.panelDiscard')}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => void c.save()}>
        {c.active === undefined ? t('table.panelSaveAs') : t('table.panelSave')}
      </Button>
    </div>
  )
}

function useLabels() {
  const t = useMessages(table)
  const rowHeight: Record<RowHeight, string> = {
    dense: t('table.panelCompact'),
    normal: t('table.panelDefault'),
    comfortable: t('table.panelComfortable'),
  }
  const preset: Record<Preset | 'custom', string> = {
    compact: t('table.panelCompact'),
    default: t('table.panelDefault'),
    wide: t('table.panelWide'),
    custom: t('table.panelCustom'),
  }
  return { rowHeight, preset }
}

function Root<T>({
  c,
  go,
}: {
  c: ViewsController<T>
  go: (page: PanelPage) => void
}): ReactElement {
  const t = useMessages(table)
  const { model, active } = c
  const labels = useLabels()
  const { request, display } = model.state
  const widths = display.widths ?? {}
  const preset: Preset | 'custom' =
    Object.keys(widths).length === 0
      ? 'default'
      : sameWidths(widths, presetWidths(model, 'compact'))
        ? 'compact'
        : sameWidths(widths, presetWidths(model, 'wide'))
          ? 'wide'
          : 'custom'
  const hidden = model.movable.filter((id) => display.visibility[id] === false).length
  const filterable = filterableSpecs(model.specs)
  const filters = activeFilters(request.filters, new Set(filterable.map((s) => s.id))).length
  const sort = request.sort[0]
  const sortSpec = sort === undefined ? undefined : model.specs.find((s) => s.id === sort.id)
  const groupable = model.specs.filter((spec) => model.groupable(spec.id))
  const groupSpec = model.specs.find((spec) => spec.id === model.groupBy)
  const copy = (): void => {
    void navigator.clipboard?.writeText(c.link())
  }
  return (
    <div className="flex flex-col gap-3">
      <Pending c={c} />
      <Group>
        {active !== undefined && (
          <Row label={t('table.panelName')} value={active.name} onClick={() => go('name')} />
        )}
        {active !== undefined && c.list.canShare && (
          <Row
            label={t('table.panelSharing')}
            value={active.sharing === 'shared' ? t('table.panelShared') : t('table.panelPrivate')}
            onClick={() => go('sharing')}
          />
        )}
        <Row label={t('table.panelCopyLink')} opens={false} onClick={copy} />
        {active !== undefined && (
          <Row
            label={t('table.panelDefaultView')}
            value={active.default === true ? t('table.panelYes') : t('table.panelNo')}
            opens={false}
            onClick={() => void c.setDefault(active.default === true ? undefined : active.id)}
          />
        )}
      </Group>
      <Group>
        <Row
          label={t('table.panelRowHeight')}
          value={labels.rowHeight[model.rowHeight ?? 'normal']}
          onClick={() => go('rowHeight')}
        />
        <Row
          label={t('table.panelColumnWidth')}
          value={labels.preset[preset]}
          onClick={() => go('columnWidth')}
        />
        <Row
          label={t('table.panelResetWidths')}
          opens={false}
          disabled={Object.keys(widths).length === 0}
          onClick={model.resetWidths}
        />
      </Group>
      <Group>
        <Row
          label={t('table.panelColumns')}
          value={hidden === 0 ? t('table.panelAllShown') : t('table.panelHidden', hidden)}
          onClick={() => go('columns')}
        />
        {filterable.length > 0 && (
          <Row
            label={t('table.panelFilter')}
            value={filters === 0 ? t('table.panelNone') : t('table.panelActive', filters)}
            onClick={() => go('filter')}
          />
        )}
        <Row
          label={t('table.panelSort')}
          value={
            sortSpec === undefined || sort === undefined
              ? t('table.panelSortDefault')
              : `${sortSpec.header} ${sort.desc ? '↓' : '↑'}`
          }
          onClick={() => go('sort')}
        />
        {groupable.length > 0 && (
          <Row
            label={t('table.panelGroup')}
            value={groupSpec?.header ?? t('table.panelNone')}
            onClick={() => go('group')}
          />
        )}
      </Group>
      <Group>
        {active === undefined ? (
          <Row label={t('table.panelSaveAs')} opens={false} onClick={() => void c.save()} />
        ) : (
          <Row
            label={t('table.panelDuplicate')}
            opens={false}
            onClick={() => void c.duplicate(active.id)}
          />
        )}
        {c.onExport !== undefined && (
          <Row label={t('table.panelExport')} opens={false} onClick={c.onExport} />
        )}
        {active !== undefined && (
          <Row label={t('table.panelRemove')} danger onClick={() => go('remove')} />
        )}
      </Group>
    </div>
  )
}

function NamePage<T>({
  c,
  onRenamed,
}: {
  c: ViewsController<T>
  onRenamed: () => void
}): ReactElement | null {
  const t = useMessages(table)
  const [name, setName] = useState(c.active?.name ?? '')
  const [taken, setTaken] = useState(false)
  const active = c.active
  if (active === undefined) return null
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (await c.rename(active.id, name)) onRenamed()
    else setTaken(true)
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
      <Input
        type="text"
        name="view-name"
        autoComplete="off"
        aria-label={t('table.panelName')}
        aria-invalid={taken || undefined}
        value={name}
        onChange={(event) => {
          setName(event.currentTarget.value)
          setTaken(false)
        }}
      />
      {taken && (
        <p role="alert" className="m-0 text-xs text-muted-foreground">
          {t('table.panelNameTaken')}
        </p>
      )}
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        disabled={name.trim() === ''}
      >
        {t('table.panelRename')}
      </Button>
    </form>
  )
}

function SharingPage<T>({ c }: { c: ViewsController<T> }): ReactElement | null {
  const t = useMessages(table)
  const active = c.active
  if (active === undefined) return null
  return (
    <RadioGroup<'private' | 'shared'>
      aria-label={t('table.panelSharing')}
      value={active.sharing ?? 'private'}
      onValueChange={(next) => void c.share(active.id, next)}
      options={[
        {
          value: 'private',
          label: t('table.panelPrivate'),
          description: t('table.panelPrivateHint'),
        },
        { value: 'shared', label: t('table.panelShared'), description: t('table.panelSharedHint') },
      ]}
    />
  )
}

function RowHeightPage<T>({ c }: { c: ViewsController<T> }): ReactElement {
  const t = useMessages(table)
  const labels = useLabels()
  const { model } = c
  return (
    <RadioGroup<RowHeight>
      aria-label={t('table.panelRowHeight')}
      value={model.rowHeight ?? 'normal'}
      onValueChange={(next) => model.setRowHeight(next)}
      options={[
        {
          value: 'dense',
          label: labels.rowHeight.dense,
          description: t('table.panelCompactRows'),
        },
        {
          value: 'normal',
          label: labels.rowHeight.normal,
          description: t('table.panelDefaultRows'),
        },
        {
          value: 'comfortable',
          label: labels.rowHeight.comfortable,
          description: t('table.panelComfortableRows'),
        },
      ]}
    />
  )
}

function ColumnWidthPage<T>({ c }: { c: ViewsController<T> }): ReactElement {
  const t = useMessages(table)
  const labels = useLabels()
  const { model } = c
  const widths = model.state.display.widths ?? {}
  const value: Preset | '' =
    Object.keys(widths).length === 0
      ? 'default'
      : sameWidths(widths, presetWidths(model, 'compact'))
        ? 'compact'
        : sameWidths(widths, presetWidths(model, 'wide'))
          ? 'wide'
          : ''
  return (
    <RadioGroup<Preset | ''>
      aria-label={t('table.panelColumnWidth')}
      value={value}
      onValueChange={(next) => {
        if (next === 'default' || next === '') model.resetWidths()
        else model.state.setDisplay({ widths: presetWidths(model, next) })
      }}
      options={[
        {
          value: 'compact',
          label: labels.preset.compact,
          description: t('table.panelCompactWidth'),
        },
        {
          value: 'default',
          label: labels.preset.default,
          description: t('table.panelDefaultWidth'),
        },
        { value: 'wide', label: labels.preset.wide, description: t('table.panelWideWidth') },
      ]}
    />
  )
}

function ColumnsPage<T>({ c }: { c: ViewsController<T> }): ReactElement {
  const t = useMessages(table)
  const { model } = c
  const { visibility } = model.state.display
  const headerOf = (id: string): string => model.specs.find((spec) => spec.id === id)?.header ?? id
  const identity = model.specs.find((_, index) => model.plan.columns[index]?.identity === true)
  const titleId = useId()
  const every = (shown: boolean): Record<string, boolean> =>
    Object.fromEntries(model.movable.map((id) => [id, shown]))
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span id={titleId} className="sr-only">
        {t('table.panelColumns')}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => model.state.setDisplay({ visibility: {} })}
        >
          {t('table.panelShowAll')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => model.state.setDisplay({ visibility: every(false) })}
        >
          {t('table.panelHideAll')}
        </Button>
      </div>
      <OrderList
        order={model.movable}
        labelOf={headerOf}
        labelledBy={titleId}
        onCommit={(id, next) => model.moveColumn(id, next.indexOf(id))}
        lead={
          identity !== undefined && (
            <li className="flex min-h-8 items-center gap-2 pe-2 pointer-coarse:min-h-11">
              <span aria-hidden="true" className="size-6 shrink-0 pointer-coarse:mx-2.5" />
              <Checkbox aria-label={identity.header} checked disabled />
              <span className="min-w-0 flex-1 truncate">{identity.header}</span>
              <span className="sr-only">{t('table.panelLocked')}</span>
              <Glyph d={LOCK} className="text-muted-foreground" />
            </li>
          )
        }
        renderItem={(id) => (
          <>
            <Checkbox
              aria-label={headerOf(id)}
              checked={visibility[id] !== false}
              onCheckedChange={(next) =>
                model.state.setDisplay({ visibility: { ...visibility, [id]: next } })
              }
            />
            <span className="min-w-0 flex-1 truncate">{headerOf(id)}</span>
          </>
        )}
      />
    </div>
  )
}

function FilterPage<T>({
  c,
  go,
}: {
  c: ViewsController<T>
  go: (page: PanelPage) => void
}): ReactElement {
  const t = useMessages(table)
  const textOf = useFilterText()
  const { model } = c
  const specs = filterableSpecs(model.specs)
  const { filters } = model.state.request
  const count = activeFilters(filters, new Set(specs.map((s) => s.id))).length
  return (
    <div className="flex flex-col gap-3">
      <Group>
        {specs.map((spec) => {
          const filter = filters.find((f) => f.id === spec.id)
          return (
            <Row
              key={spec.id}
              label={spec.header}
              value={filter === undefined ? t('table.panelAny') : textOf(spec, filter).value}
              onClick={() => go(`filter:${spec.id}`)}
            />
          )
        })}
      </Group>
      {count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => model.state.setRequest({ filters: [] })}
        >
          {t('table.panelClearFilters')}
        </Button>
      )}
    </div>
  )
}

function ColumnFilterPage<T>({
  c,
  id,
}: {
  c: ViewsController<T>
  id: string
}): ReactElement | null {
  const spec = filterableSpecs(c.model.specs).find((s) => s.id === id)
  if (spec === undefined) return null
  return <FilterEditor model={c.model} spec={spec as KindSpec<T> & FilterableSpec} />
}

function SortPage<T>({ c }: { c: ViewsController<T> }): ReactElement {
  const t = useMessages(table)
  const { model } = c
  const sort = model.state.request.sort[0]
  const sortable = model.specs.filter((spec) => spec.sort !== null)
  return (
    <div className="flex flex-col gap-4">
      <RadioGroup<string>
        aria-label={t('table.panelSort')}
        value={sort?.id ?? ''}
        onValueChange={(next) =>
          model.state.setRequest({
            sort: next === '' ? [] : [{ id: next, desc: sort?.desc ?? false }],
          })
        }
        options={[
          { value: '', label: t('table.panelSortDefault') },
          ...sortable.map((spec) => ({ value: spec.id, label: spec.header })),
        ]}
      />
      {sort !== undefined && (
        <RadioGroup<'asc' | 'desc'>
          aria-label={t('table.panelDirection')}
          value={sort.desc ? 'desc' : 'asc'}
          onValueChange={(next) =>
            model.state.setRequest({ sort: [{ id: sort.id, desc: next === 'desc' }] })
          }
          options={[
            { value: 'asc', label: t('table.panelAscending') },
            { value: 'desc', label: t('table.panelDescending') },
          ]}
        />
      )}
    </div>
  )
}

function GroupPage<T>({ c }: { c: ViewsController<T> }): ReactElement {
  const t = useMessages(table)
  const { model } = c
  const groupable = model.specs.filter((spec) => model.groupable(spec.id))
  return (
    <RadioGroup<string>
      aria-label={t('table.panelGroup')}
      value={model.groupBy ?? ''}
      onValueChange={(next) => model.setGroupBy(next === '' ? null : next)}
      options={[
        { value: '', label: t('table.panelNone') },
        ...groupable.map((spec) => ({ value: spec.id, label: spec.header })),
      ]}
    />
  )
}

function RemovePage<T>({
  c,
  back,
}: {
  c: ViewsController<T>
  back: () => void
}): ReactElement | null {
  const t = useMessages(table)
  const active = c.active
  if (active === undefined) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm">{t('table.panelRemoveConfirm', active.name)}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          onClick={() => {
            void c.remove(active.id)
            c.close()
          }}
        >
          {t('table.panelRemove')}
        </Button>
        <Button variant="ghost" onClick={back}>
          {t('table.panelCancel')}
        </Button>
      </div>
    </div>
  )
}

/** The title of a page: the root's, the property's, or the column a filter page edits. */
function useTitle<T>(c: ViewsController<T>, page: PanelPage): string {
  const t = useMessages(table)
  if (page.startsWith('filter:')) {
    const id = page.slice('filter:'.length)
    const header = c.model.specs.find((spec) => spec.id === id)?.header ?? id
    return t('table.panelFilterOf', header)
  }
  const titles: Record<Exclude<PanelPage, `filter:${string}`>, string> = {
    root: c.active === undefined ? t('table.panelTitle') : t('table.panelTitleOf', c.active.name),
    name: t('table.panelName'),
    sharing: t('table.panelSharing'),
    rowHeight: t('table.panelRowHeight'),
    columnWidth: t('table.panelColumnWidth'),
    columns: t('table.panelColumns'),
    filter: t('table.panelFilter'),
    sort: t('table.panelSort'),
    group: t('table.panelGroup'),
    remove: t('table.panelRemove'),
  }
  return titles[page as Exclude<PanelPage, `filter:${string}`>]
}

function Body<T>({ c }: { c: ViewsController<T> }): ReactElement {
  const page = c.door.page
  const go = (next: PanelPage): void => c.show(next)
  const back = (): void => c.show(parentPage(page))
  const content =
    page === 'root' ? (
      <Root c={c} go={go} />
    ) : page === 'name' ? (
      <NamePage key={c.active?.id} c={c} onRenamed={back} />
    ) : page === 'sharing' ? (
      <SharingPage c={c} />
    ) : page === 'rowHeight' ? (
      <RowHeightPage c={c} />
    ) : page === 'columnWidth' ? (
      <ColumnWidthPage c={c} />
    ) : page === 'columns' ? (
      <ColumnsPage c={c} />
    ) : page === 'filter' ? (
      <FilterPage c={c} go={go} />
    ) : page === 'sort' ? (
      <SortPage c={c} />
    ) : page === 'group' ? (
      <GroupPage c={c} />
    ) : page === 'remove' ? (
      <RemovePage c={c} back={back} />
    ) : (
      <ColumnFilterPage c={c} id={page.slice('filter:'.length)} />
    )
  return (
    <div data-slot="table-view-panel" data-page={page} className="flex flex-col gap-3">
      {page !== 'root' && <Back onClick={back} />}
      {content}
    </div>
  )
}

/** The panel of one set of views: nothing while closed, a `Dock` or a phone's bottom sheet while open. */
export function ViewPanel<T>({ c }: { c: ViewsController<T> }): ReactElement | null {
  const sizeClass = useSizeClass()
  const title = useTitle(c, c.door.page)
  if (sizeClass === 'compact') {
    return (
      <Sheet
        open={c.door.open}
        placement="bottom"
        onOpenChange={(open) => {
          if (!open) c.close()
        }}
      >
        <SheetContent title={title}>
          <Body c={c} />
        </SheetContent>
      </Sheet>
    )
  }
  if (!c.door.open) return null
  return (
    <Dock title={title} onClose={c.close}>
      <Body c={c} />
    </Dock>
  )
}
