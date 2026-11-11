// A primitive basalt does not ship: adopting it is new local code.
import type { ReactElement } from 'react'

export function OtpField({ length }: { length: number }): ReactElement {
  return <div data-slot="otp-field" data-length={length} />
}
