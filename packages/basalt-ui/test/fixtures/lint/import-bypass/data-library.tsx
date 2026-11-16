// Fixture: import-boundary/data-library
// @invalid
import useSWR from 'swr'
// @invalid
import useSWRInfinite from 'swr/infinite'
// @invalid
import { io } from 'socket.io-client'
// @valid
import { liveQuery } from 'basalt-ui/data'
// @valid
import { createChannel } from 'basalt-ui'
// @invalid
import { fetchEventSource } from '@microsoft/fetch-event-source'
// @invalid
import useWebSocket from 'react-use-websocket'
// @invalid
import { useQueryState } from 'nuqs'
// @valid
import { field } from 'basalt-ui/router'
