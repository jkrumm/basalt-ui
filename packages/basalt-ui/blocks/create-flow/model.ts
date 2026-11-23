/** The create flow's option lists and the slices of the supplier and part it reads. */
export const WAREHOUSES = [
  { value: 'main', label: 'Main warehouse', description: 'Bays A to D, goods in at gate 2.' },
  { value: 'line-2', label: 'Line 2 store', description: 'Straight to the line, no inspection.' },
  { value: 'quarantine', label: 'Inspection hold', description: 'Checked before it is put away.' },
] as const

export type Supplier = {
  id: string
  name: string
  /** Days from order to delivery, quoted. */
  leadDays: number
}

export type Part = {
  id: string
  sku: string
  name: string
  supplierId: string
  /** Unit cost in EUR. */
  unitCost: number
}
