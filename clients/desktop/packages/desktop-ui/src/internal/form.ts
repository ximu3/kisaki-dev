/** @fileoverview Shares a mounted form's field issues and focus with field and feedback parts. */

import { createContext } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Correction associated with a stable field identity in the complete edit. */
export interface FieldIssue {
  readonly id: string
  readonly summary: string
  readonly message?: string
}

/** Live feedback supplied to controls inside one form instance. */
export interface FormFeedbackState {
  issues: Accessor<readonly FieldIssue[]>
  activeFieldId: Accessor<string | null>
  message: Accessor<string | undefined>
  locate: (id: string) => void
  refresh: () => void
}

/** Separates each form's validation and feedback from other mounted editors. */
export const FormContext = createContext<FormFeedbackState>()
