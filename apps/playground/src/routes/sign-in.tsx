import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '../auth/sign-in-page'

/** Outside the shell (`__root.tsx` draws the auth paths bare). */
export const Route = createFileRoute('/sign-in')({
  staticData: { title: 'Sign in' },
  component: SignInPage,
})
