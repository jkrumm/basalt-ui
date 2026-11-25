/**
 * Sign in: a username and a password, a forgotten-password path that ends in a sent state, and the
 * demo's one login. Fields name their autofill token, check on blur and again on submit; the stub's
 * refusal reaches the form through `toSubmitErrors`.
 */
import { useNavigate, Link } from '@tanstack/react-router'
import { toSubmitErrors } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
import { Alert } from 'basalt-ui/ui/alert'
import { Button } from 'basalt-ui/ui/button'
import { Input } from 'basalt-ui/ui/input'
import { PasswordInput } from 'basalt-ui/ui/password-input'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { AuthLayout } from './layout'
import { DEMO_LOGIN, requestReset, signIn } from './stub'

type View = { kind: 'sign-in' } | { kind: 'forgot' } | { kind: 'sent'; email: string }

const USERNAME = z.string().min(1, 'Enter your username.')
const PASSWORD = z.string().min(1, 'Enter your password.')
const EMAIL = z.email('Enter a full address, like ada@example.com.')

function SignInForm({ onForgot }: { onForgot: () => void }): ReactElement {
  const navigate = useNavigate()
  const form = useAppForm({
    defaultValues: { username: '', password: '' },
    validators: { onSubmitAsync: toSubmitErrors(signIn) },
    onSubmit: () => {
      void navigate({ to: '/' })
    },
  })
  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-4">
        <Alert tone="info" title="Demo account">
          Sign in with {DEMO_LOGIN.username} and {DEMO_LOGIN.password}.
        </Alert>
        <form.AppField name="username" validators={{ onDynamic: USERNAME }}>
          {(f) => (
            <f.FormField label="Username" required>
              <Input autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="password" validators={{ onDynamic: PASSWORD }}>
          {(f) => (
            <f.FormField label="Password" required>
              <PasswordInput autoComplete="current-password" />
            </f.FormField>
          )}
        </form.AppField>
        <Button variant="ghost" size="sm" className="self-start" onClick={onForgot}>
          Forgot your password?
        </Button>
        <form.Footer actions={[{ label: 'Sign in', primary: true }]} />
      </form.Form>
    </form.AppForm>
  )
}

function ForgotForm({
  onSent,
  onBack,
}: {
  onSent: (email: string) => void
  onBack: () => void
}): ReactElement {
  const form = useAppForm({
    defaultValues: { email: '' },
    validators: { onSubmitAsync: toSubmitErrors(requestReset) },
    onSubmit: ({ value }) => {
      onSent(value.email)
    },
  })
  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-4">
        <form.AppField name="email" validators={{ onDynamic: EMAIL }}>
          {(f) => (
            <f.FormField
              label="Email"
              description="We send a link that sets a new password."
              required
            >
              <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} />
            </f.FormField>
          )}
        </form.AppField>
        <form.Footer
          actions={[
            { label: 'Back to sign in', onClick: onBack },
            { label: 'Send reset link', primary: true },
          ]}
        />
      </form.Form>
    </form.AppForm>
  )
}

export function SignInPage(): ReactElement {
  const [view, setView] = useState<View>({ kind: 'sign-in' })
  const back = (): void => {
    setView({ kind: 'sign-in' })
  }
  return (
    <AuthLayout
      title={view.kind === 'sign-in' ? 'Sign in' : 'Reset your password'}
      area="sign-in"
      below={
        <>
          No account?
          <Button variant="ghost" size="sm" render={<Link to="/register" />}>
            Register
          </Button>
        </>
      }
    >
      {view.kind === 'sign-in' && (
        <SignInForm
          onForgot={() => {
            setView({ kind: 'forgot' })
          }}
        />
      )}
      {view.kind === 'forgot' && (
        <ForgotForm
          onSent={(email) => {
            setView({ kind: 'sent', email })
          }}
          onBack={back}
        />
      )}
      {view.kind === 'sent' && (
        <div className="flex flex-col gap-4">
          <Alert tone="good" title="Check your inbox">
            If an account exists for {view.email}, a reset link is on its way.
          </Alert>
          <Button variant="secondary" onClick={back}>
            Back to sign in
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
