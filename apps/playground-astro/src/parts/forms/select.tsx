import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'basalt-ui/ui/select'
import type { ReactElement } from 'react'
import { ENVIRONMENTS, PERIODS } from './fixtures'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xs flex-col gap-3">
      <Select aria-label="Default environment" options={ENVIRONMENTS} defaultValue="staging" />
      <Select items={PERIODS} defaultValue="week">
        <SelectTrigger aria-label="Report period">
          <SelectValue placeholder="Pick a period" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup label="Periods">
            {PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
