// Fixture: import-boundary/react-table-hook
// @invalid
import { useReactTable } from '@tanstack/react-table'
// @invalid
import { useReactTable as useTable } from '@tanstack/react-table'
// @invalid
const table = Table.useReactTable({ data, columns })
// @valid
import { DataTable } from 'basalt-ui/table'
// @valid
import { createColumnHelper } from '@tanstack/react-table'
