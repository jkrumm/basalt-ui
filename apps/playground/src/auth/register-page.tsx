/**
 * Register: a name, an email and a new password. The stub accepts every valid entry except the
 * demo's own address, which comes back as a field error under Email.
 */
import { Link, useNavigate } from '@tanstack/react-router'
import { toSubmitErrors } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
import { Button } from 'basalt-ui/ui/button'
import { Input } from 'basalt-ui/ui/input'
import { PasswordInput } from 'basalt-ui/ui/password-input'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { AuthLayout } from './layout'
import { register } from './stub'

const NAME = z.string().min(2, 'Use at least 2 characters.')
const EMAIL = z.email('Enter a full address, like ada@example.com.')
const PASSWORD = z.string().min(8, 'Use at least 8 characters.')

function RegisterForm(): ReactElement {
  const navigate = useNavigate()
  const form = useAppForm({
    defaultValues: { name: '', email: '', password: '' },
    validators: { onSubmitAsync: toSubmitErrors(register) },
    onSubmit: () => {
      void navigate({ to: '/' })
    },
  })
  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-4">
        <form.AppField name="name" validators={{ onDynamic: NAME }}>
          {(f) => (
            <f.FormField label="Name" required>
              <Input autoComplete="name" />
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="email" validators={{ onDynamic: EMAIL }}>
          {(f) => (
            <f.FormField
              label="Email"
              description="Try demo@example.com to see a server error."
              required
            >
              <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} />
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="password" validators={{ onDynamic: PASSWORD }}>
          {(f) => (
            <f.FormField label="Password" description="At least 8 characters." required>
              <PasswordInput autoComplete="new-password" />
            </f.FormField>
          )}
        </form.AppField>
        <form.Footer actions={[{ label: 'Create account', primary: true }]} />
      </form.Form>
    </form.AppForm>
  )
}

export function RegisterPage(): ReactElement {
  return (
    <AuthLayout
      title="Create your account"
      area="register"
      below={
        <>
          Already registered?
          <Button variant="ghost" size="sm" render={<Link to="/sign-in" />}>
            Sign in
          </Button>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  )
}
