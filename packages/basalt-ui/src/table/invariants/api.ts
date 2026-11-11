/**
 * The only runtime door into the v3 table for the invariant tests. `DataTable`, `useDataTable`
 * and `col` are not in the 2.x barrel yet, so they are read off the namespace and cast to the
 * contract types: a named import of a missing export is a link and tsc error, a cast is not.
 * Until the flipper Issue lands each is `undefined`, so a test that uses one throws and its
 * `test.failing` passes.
 */
import type { ReactElement } from 'react'
import * as barrel from '../index'
import type { DataTableInstance, DataTableProps, KindColumn, UseDataTable } from '../contract'

/** The kind constructors the invariants need (a subset of `col<T>()` in the concept sketch). */
export type ColFactory<T> = {
  text(id: keyof T & string, o?: { header?: string; priority?: 1 | 2 | 3 }): KindColumn<T>
  money(id: keyof T & string, o: { currency: string; header?: string }): KindColumn<T>
  status(
    id: keyof T & string,
    o: { options: readonly string[]; filter?: 'multi'; header?: string },
  ): KindColumn<T>
  select(
    id: keyof T & string,
    o: {
      label: (row: T) => string
      options: readonly string[]
      commit: (row: T, value: string) => void
    },
  ): KindColumn<T>
  actions(actions: readonly { key: string; label: string; onClick(row: T): void }[]): KindColumn<T>
}

type Api = {
  DataTable: <T>(props: DataTableProps<T>) => ReactElement
  useDataTable: <T>(options: UseDataTable<T>) => DataTableInstance<T>
  col: <T>() => ColFactory<T>
}

export const api = barrel as unknown as Api
