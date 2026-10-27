import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'

/** Native button attributes; disabled, keyboard and form semantics stay with the browser. */
export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement>

/** Render a native button using shared visual tokens; form submission remains opt-in. */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'type', 'children'])

  return (
    <button type={local.type ?? 'button'} class={`kisaki-button ${local.class ?? ''}`} {...rest}>
      {local.children}
    </button>
  )
}
