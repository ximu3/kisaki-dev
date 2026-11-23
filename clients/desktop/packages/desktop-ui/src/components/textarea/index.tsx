import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl, type TextValueProps } from '../../internal/text-control'
import surface from '../../internal/input-surface.module.css'
import styles from './styles.module.css'

/** Native multiline text attributes with controlled value and default reset-baseline support. */
export interface TextareaProps
  extends
    Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'defaultValue' | 'value'>,
    TextValueProps {}

/**
 * Binds multiline native editing and Field associations while preserving selection, composition and
 * undo.
 *
 * The caller owns persistence.
 */
export function Textarea(props: TextareaProps): JSX.Element {
  const rest = omit(props, 'value', 'defaultValue', 'onValueChange', 'ref', 'class', 'onInput')

  let input!: HTMLTextAreaElement
  const update = bindTextControl(props, () => input)

  return (
    <textarea
      rows={4}
      {...fieldAttributes(props)}
      {...rest}
      ref={[
        (node) => {
          input = node
        },
        props.ref,
      ]}
      class={[surface.surface, styles.root, props.class]}
      onInput={(event) => {
        update()
        callHandler(props.onInput, event)
      }}
    />
  )
}
