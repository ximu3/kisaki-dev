/** @fileoverview Coordinates submit-time field errors, accessible descriptions and focus inside an editor. */

import { createMemo, createSignal, createUniqueId, For } from 'solid-js'
import { FormFeedback, type FieldIssue } from '@kisaki3/desktop-ui/field'
import type { MainClient } from '../../../infrastructure/api'

/** Reveals the first invalid field on submission and maintains its feedback during further edits. */
export function createEditorValidation(
  api: MainClient,
  inspect: () => readonly FieldIssue[],
  locate: (key: string) => void,
) {
  const prefix = createUniqueId()
  const [attempted, setAttempted] = createSignal(false)
  const [focus, setFocus] = createSignal<string | null>(null)
  const issues = createMemo(() => (attempted() ? inspect() : []))

  return {
    focus: setFocus,
    /** Connects one focusable field to its independent error text. */
    errorId(key: string) {
      return issues().some((issue) => issue.id === key) ? prefix + '-' + key : undefined
    },
    /** Resets feedback when the edit has been committed or discarded. */
    clear() {
      setAttempted(false)
      setFocus(null)
    },
    /** Moves focus only for the submit that requested validation. */
    validate() {
      setAttempted(true)
      const first = issues()[0]
      if (first) {
        locate(first.id)
      }
      return !first
    },
    /** Keeps the summary and each field's description available at the submit controls. */
    Feedback(this: void) {
      return (
        <>
          <FormFeedback
            issues={issues()}
            activeFieldId={focus()}
            summary={(count) => api.t('runtime.fieldErrors', { count })}
            onLocate={locate}
          />
          <For each={issues()}>
            {(issue) => (
              <span class="sr-only" id={prefix + '-' + issue.id}>
                {issue.summary}
              </span>
            )}
          </For>
        </>
      )
    },
  }
}
