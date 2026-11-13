// Blocks: see colour-literal.tsx.

// @invalid
const q = useQuery({ queryKey: ['gyms'], queryFn, refetchInterval: 30_000 })

// @invalid
const q = useQuery({ queryKey: ['gyms'], queryFn, refetchInterval: (query) => poll(query) })

// @invalid
const q = useQuery({ queryKey: ['gyms'], queryFn, refetchInterval: false })

// @invalid
const q = useQuery({ queryKey: ['gyms'], queryFn, 'refetchIntervalInBackground': true })

// @invalid
const q = <Poller refetchInterval={5000} />

// @valid
const q = useQuery({ queryKey: ['gyms'], queryFn })

// @valid
const q = useQuery(liveQuery(gymsOptions, 'fast'))

// @valid
const { refetchInterval } = props
