// oxlint-disable import/no-default-export -- vite config requires a default export
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { basalt } from 'basalt-ui/vite'

export default { plugins: [react(), tailwindcss(), basalt()], logLevel: 'warn' }
