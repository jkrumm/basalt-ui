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
// @invalid
import { useSearchParams } from 'react-router-dom'
// @invalid
import { useNavigate } from 'react-router'
// @invalid
import { useQuery, gql } from '@apollo/client'
// @valid
import { useQuery } from '@tanstack/react-query'
// @invalid
import { useQuery } from 'react-query'
// @invalid
import { useQuery } from 'urql'
// @invalid
import { Route } from 'wouter'
// @invalid
import { useQueryParam } from 'use-query-params'
// @invalid
import Pusher from 'pusher-js'
// @invalid
import * as Ably from 'ably'
