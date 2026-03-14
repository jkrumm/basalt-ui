'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const navItems = [
  { label: 'Overview', count: null, active: false },
  { label: 'Components', count: 24, active: true },
  { label: 'Documentation', count: null, active: false },
  { label: 'Changelog', count: 3, active: false },
  { label: 'Settings', count: null, active: false },
]

const fileTree = [
  { label: 'packages/', indent: 0, isDir: true },
  { label: 'basalt-ui/', indent: 1, isDir: true },
  { label: 'src/', indent: 2, isDir: true },
  { label: 'index.css', indent: 3, isDir: false },
  { label: 'apps/', indent: 0, isDir: true },
  { label: 'marketing/', indent: 1, isDir: true },
]

const tasks = [
  { label: 'Theme tokens', value: 100 },
  { label: 'Component showcase', value: 75 },
  { label: 'Documentation', value: 40 },
]

function SidebarPanel({ dark }: { dark: boolean }) {
  const wrapper = dark
    ? 'dark bg-dark-2 text-light-3 border-dark-3'
    : 'bg-light-2 text-dark-4 border-gray-light-1'
  const itemHover = dark ? 'hover:bg-dark-4' : 'hover:bg-light-3'
  const activeItem = dark ? 'bg-blue text-white' : 'bg-blue text-white'
  const inputCls = dark
    ? 'border-dark-4 bg-dark-3 placeholder:text-gray-mid-2 text-light-3'
    : 'border-gray-light-3 bg-white placeholder:text-gray-mid-3 text-dark-4'
  const separatorCls = dark ? 'bg-dark-4' : 'bg-gray-light-3'
  const sectionLabel = dark ? 'text-gray-mid-3' : 'text-gray-mid-2'
  const mutedText = dark ? 'text-gray-mid-3' : 'text-gray-mid-2'

  return (
    <div className={`flex h-full flex-col rounded border ${wrapper} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-small font-bold">Basalt UI</span>
        <span className={`text-caption ${mutedText}`}>v0.4.2</span>
      </div>

      {/* Tabs */}
      <div className="border-b px-2 pt-2">
        <Tabs defaultValue="browse">
          <TabsList variant="line">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="starred">Starred</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="border-b px-2 py-2">
        <Input placeholder="Search..." className={`h-6 text-xs ${inputCls}`} type="search" />
      </div>

      {/* Nav list */}
      <div className="flex-1 overflow-auto p-1">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-small ${
              item.active ? activeItem : itemHover
            }`}
          >
            <span>{item.label}</span>
            {item.count !== null && (
              <span
                className={`rounded px-1.5 text-caption ${
                  item.active
                    ? 'bg-white/20 text-white'
                    : dark
                      ? 'bg-dark-5 text-gray-mid-4'
                      : 'bg-gray-light-2 text-gray-mid-1'
                }`}
              >
                {item.count}
              </span>
            )}
          </div>
        ))}

        <div className={`my-2 h-px ${separatorCls}`} />

        {/* Section label */}
        <p className={`px-2 py-1 text-caption font-bold tracking-wide uppercase ${sectionLabel}`}>
          Files
        </p>

        {/* File tree */}
        {fileTree.map((item) => (
          <div
            key={`${item.indent}-${item.label}`}
            style={{ paddingLeft: `${item.indent * 12 + 8}px` }}
            className={`flex cursor-pointer items-center gap-1 rounded py-1 pr-2 text-caption ${itemHover}`}
          >
            <span className={item.isDir ? 'opacity-60' : ''}>{item.isDir ? '📁' : '📄'}</span>
            <span className={item.isDir ? mutedText : ''}>{item.label}</span>
          </div>
        ))}

        <div className={`my-2 h-px ${separatorCls}`} />

        {/* Progress section */}
        <p className={`px-2 py-1 text-caption font-bold tracking-wide uppercase ${sectionLabel}`}>
          Progress
        </p>
        <div className="space-y-2 px-2 pb-2">
          {tasks.map((task) => (
            <div key={task.label} className="space-y-1">
              <div className="flex items-center gap-2">
                <Checkbox checked={task.value === 100} />
                <span className="text-caption flex-1">{task.label}</span>
                <span className={`text-caption ${mutedText}`}>{task.value}%</span>
              </div>
              <Progress value={task.value}>
                <ProgressTrack className="h-1">
                  <ProgressIndicator className={task.value === 100 ? 'bg-green' : 'bg-primary'} />
                </ProgressTrack>
              </Progress>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-2">
        <Button size="sm" variant="outline" className="w-full text-xs">
          View all
        </Button>
      </div>
    </div>
  )
}

export function SidebarShowcase() {
  return (
    <div className="rounded bg-card border border-border p-6">
      <h2 className="mb-6 text-h5 font-bold">Sidebar Panel</h2>
      <div className="grid h-[520px] gap-4 md:grid-cols-2">
        <SidebarPanel dark />
        <SidebarPanel dark={false} />
      </div>
    </div>
  )
}
