import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'basalt-ui/ui/table'
import type { ReactElement } from 'react'
import { RUNS } from '../../demo/data'

export function Demo(): ReactElement {
  return (
    <Table>
      <TableCaption>Last five runs, distance in km.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead numeric>Distance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {RUNS.slice(0, 5).map((run) => (
          <TableRow key={run.id}>
            <TableCell>{run.name}</TableCell>
            <TableCell numeric>{run.km.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
