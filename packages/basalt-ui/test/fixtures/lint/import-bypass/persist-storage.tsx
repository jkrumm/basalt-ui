// Fixture: import-boundary/persist-storage. A file that names StorageLike is the adapter.
// @invalid
import { persist } from 'zustand/middleware'
// @invalid
import { atomWithStorage } from 'jotai/utils'
// @invalid
import { useLocalStorage } from '@mantine/hooks'
// @invalid
import useLocalStorage from 'use-local-storage'
// @invalid
import * as middleware from 'zustand/middleware'
// @invalid
import { persistentAtom } from '@nanostores/persistent'
// @invalid
import { persistentMap } from '@nanostores/persistent'
// @valid
import { atom } from 'nanostores'
// @valid
import { devtools } from 'zustand/middleware'
// @valid
import { useDisclosure } from '@mantine/hooks'
// @valid
import { persisted } from 'basalt-ui'
// @valid
import { persist } from 'zustand/middleware'
export const StorageLike = { getItem, setItem, removeItem }
// @invalid
const { persist } = require('zustand/middleware')
// @invalid
export * from 'jotai/utils'
// @invalid
const mod = await import('zustand/middleware')
// @invalid
export { persist } from 'zustand/middleware'
// @invalid
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
export const persister = createSyncStoragePersister({ storage: window.localStorage })
// @invalid
import { get, set } from 'idb-keyval'
// @valid
import { get, set } from 'idb-keyval'
export const backend = { kind: StorageLike, get, set }
// @invalid
import localforage from 'localforage'
// @invalid
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
