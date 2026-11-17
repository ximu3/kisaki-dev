/** @fileoverview Supplies localized empty and invalid-choice feedback to native-window selectors. */

import { Select } from '@kisaki3/desktop-ui/select'
import type { MainClient } from '../../../infrastructure/api'

/** A named single selection whose application value is one of its declared option keys. */
export function WindowSelect<V extends string>(props: {
  api: MainClient
  label: string
  errorId?: string | undefined
  value: V
  options: readonly { value: V; label: string; disabled?: boolean }[]
  change: (value: V) => void
}) {
  return (
    <Select
      class="window-select"
      aria-label={props.label}
      aria-invalid={props.errorId ? true : undefined}
      aria-describedby={props.errorId}
      value={props.value}
      options={props.options}
      emptyMessage={props.api.t('runtime.noOptions')}
      invalidSelectionMessage={props.api.t('runtime.unavailable')}
      onValueChange={(key) => {
        const option = props.options.find((item) => item.value === key)
        if (option) {
          props.change(option.value)
        }
      }}
    />
  )
}
