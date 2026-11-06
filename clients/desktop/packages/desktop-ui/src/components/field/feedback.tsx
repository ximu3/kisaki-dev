/** @fileoverview Fixed form feedback with caller-owned issues and explicit field-location actions. */

import { createEffect, createMemo, createSignal, For, Show, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import { Button } from '../button/control'
import { Popover, PopoverTrigger, PopoverContent } from '../popover/parts'
import styles from './feedback.module.css'

/** summary is a concise complete correction; message retains the full explanation in details. */
export interface FieldIssue {
  readonly id: string
  readonly label: string

  readonly summary: string
  readonly message: string
}

/** undefined activeFieldId retains feedback focus, null indicates a different valid field. */
export interface FormFeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  issues: readonly FieldIssue[]
  activeFieldId?: string | null | undefined
  onLocate: (id: string) => void

  summary: (count: number) => string
  detailsLabel: string
  locateLabel: string
  message?: string
}

/** Reserve a stable area. Submission, validation and revealing hidden fields are handled by the host form. */
export function FormFeedback(props: FormFeedbackProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'issues',
    'activeFieldId',
    'summary',
    'onLocate',
    'detailsLabel',
    'locateLabel',
    'message',
    'class',
  ])

  const [remembered, setRemembered] = createSignal<string | null>(null)
  const [details, setDetails] = createSignal(false)
  createEffect(() => {
    if (local.activeFieldId !== undefined) {
      setRemembered(local.activeFieldId)
    }
  })

  const current = createMemo(() => local.issues.find((issue) => issue.id === remembered()))
  const text = () => {
    if (local.message !== undefined) {
      return local.message
    }

    const issue = current()
    if (issue) {
      return `${issue.label}: ${issue.summary}`
    }

    return local.issues.length ? local.summary(local.issues.length) : ''
  }

  return (
    <div {...rest} class={classes(styles.root, local.class)}>
      <div class={styles.message} role="status" aria-live="polite">
        {text()}
      </div>
      <Show when={local.issues.length > 0}>
        <div class={styles.actions}>
          <Show when={current() && local.issues.length > 1}>
            <span>{local.summary(local.issues.length - 1)}</span>
          </Show>
          <Button
            variant="text"
            size="sm"
            onClick={() => local.onLocate(current()?.id ?? local.issues[0]!.id)}
          >
            {local.locateLabel}
          </Button>
          <Popover open={details()} onOpenChange={setDetails}>
            <PopoverTrigger variant="outline" size="sm">
              {local.detailsLabel}
            </PopoverTrigger>
            <PopoverContent role="region" aria-label={local.detailsLabel} class={styles.details}>
              <p>{local.summary(local.issues.length)}</p>
              <ul>
                <For each={local.issues}>
                  {(issue) => (
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setDetails(false)
                          setRemembered(issue.id)
                          local.onLocate(issue.id)
                        }}
                      >
                        {issue.label}
                      </button>
                      <p>{issue.message}</p>
                    </li>
                  )}
                </For>
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      </Show>
    </div>
  )
}
