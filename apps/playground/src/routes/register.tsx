import { createFileRoute } from '@tanstack/react-router'
import { RegisterPage } from '../auth/register-page'

/** Outside the shell (`__root.tsx` draws the auth paths bare). */
export const Route = createFileRoute('/register')({
  staticData: { title: 'Register' },
  component: RegisterPage,
})
