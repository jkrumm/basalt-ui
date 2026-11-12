// What `./table` stands on and does not own: the 10-feature engine through `createTableHook` plus every
// `ui/*` symbol the table's parts and kinds import (with the `core/*` they pull in, `cn` first). Table
// minus floor is the own code of `./table` excluding `ui/*` (spike S5, harness `run.ts`).
import { createRoot } from 'react-dom/client'
import { tableEngine } from '../../../../packages/basalt-ui/src/table/core/features'
import { DeltaBadge } from '../../../../packages/basalt-ui/src/ui/badge'
import { Button, Pressable } from '../../../../packages/basalt-ui/src/ui/button'
import { Checkbox } from '../../../../packages/basalt-ui/src/ui/checkbox'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from '../../../../packages/basalt-ui/src/ui/menu'
import { Meter } from '../../../../packages/basalt-ui/src/ui/meter'
import { NativeSelect } from '../../../../packages/basalt-ui/src/ui/select'
import { Skeleton } from '../../../../packages/basalt-ui/src/ui/skeleton'
import { Status } from '../../../../packages/basalt-ui/src/ui/status'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../packages/basalt-ui/src/ui/table'

const USED = [
  DeltaBadge,
  Button,
  Pressable,
  Checkbox,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Meter,
  NativeSelect,
  Skeleton,
  Status,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
]

function Floor() {
  const table = tableEngine.useAppTable({ columns: [], data: [] })
  return <div>{table.getRowModel().rows.length + USED.length}</div>
}

const root = document.getElementById('root')
if (root !== null) createRoot(root).render(<Floor />)
