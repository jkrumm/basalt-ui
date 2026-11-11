import { basalt } from 'basalt-ui/vite'

// argo's dashboard: the Vite app lives one level above its declared root.
export default {
  plugins: [basalt()],
  logLevel: 'silent',
}
