/** The settings page's pane keys, their copy and the option lists its panes read. */
export const SECTIONS = ['reordering', 'notifications', 'appearance', 'workspace'] as const
export type SectionId = (typeof SECTIONS)[number]

export const COPY: Record<SectionId, { title: string; body: string }> = {
  reordering: { title: 'Reordering', body: 'When a part is reordered and where it is received.' },
  notifications: {
    title: 'Notifications',
    body: 'Which stock and order events reach whom, and how.',
  },
  appearance: {
    title: 'Appearance',
    body: 'How the app looks on this device. Changes apply at once.',
  },
  workspace: { title: 'Workspace', body: 'Exports and removal of the inventory.' },
}

export const POLICIES = [
  {
    value: 'point',
    label: 'Reorder point',
    description: "Order the reorder quantity when stock falls below the part's reorder point.",
  },
  {
    value: 'minmax',
    label: 'Minimum and maximum',
    description: 'Top up to the maximum whenever stock falls below the minimum.',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Buyers place every order by hand; nothing is suggested.',
  },
] as const

export const WAREHOUSES = [
  { value: 'main', label: 'Main warehouse' },
  { value: 'line-2', label: 'Line 2 store' },
  { value: 'quarantine', label: 'Inspection hold' },
] as const

export const EVENTS = [
  { id: 'low', label: 'Stock below reorder point', description: 'Once per part, when it crosses.' },
  { id: 'out', label: 'Out of stock' },
  { id: 'late', label: 'Delivery late', description: 'The morning after the due day.' },
  { id: 'confirmed', label: 'Order confirmed' },
  { id: 'quality', label: 'Quality issue logged' },
]

export const CHANNELS = [
  { id: 'email', label: 'Email' },
  { id: 'app', label: 'In app' },
  { id: 'digest', label: 'Daily digest' },
]
