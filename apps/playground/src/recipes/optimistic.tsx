// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:optimistic
import { useMutation } from '@tanstack/react-query'
import { optimistic } from 'basalt-ui/data'

export function useSaveRun(id: string) {
  return useMutation({
    mutationFn: (values: RunValues) => runsApi.save(values),
    ...optimistic<RunValues>({
      key: runKey(id),
      targets: [
        { queryKey: runKey(id), apply: (prev, values) => ({ ...(prev as Run), ...values }) },
      ],
    }),
  })
}
// #endregion

export type RunValues = {
  title: string
  notes: string
  km: number
  kind: 'easy' | 'tempo' | 'long'
  intervals: number
  shoes: string
}
export type Run = RunValues & { id: string }

/** What a failed save throws: the shape `toSubmitErrors` maps onto the form and its fields. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
  }
}

// A stand-in server: one run, a little latency, two refusals ("taken" on the title, "down" for all).
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
let stored: Run = {
  id: 'r-1',
  title: 'Sunday long run',
  notes: 'Easy pace, river loop.',
  km: 21.1,
  kind: 'long',
  intervals: 0,
  shoes: 'Pegasus 41',
}

export const runsApi = {
  async get(): Promise<Run> {
    await wait(250)
    return stored
  },
  async titleTaken(title: string): Promise<boolean> {
    await wait(300)
    return title.trim().toLowerCase() === 'taken'
  },
  async save(values: RunValues): Promise<Run> {
    await wait(700)
    if (values.title.trim().toLowerCase() === 'down') throw new ApiError('The server is down.')
    if (values.title.trim().toLowerCase() === 'taken') {
      throw new ApiError('Nothing was saved.', { title: 'That title is taken.' })
    }
    stored = { ...stored, ...values }
    return stored
  },
}

export const runKey = (id: string) => ['run', id] as const
