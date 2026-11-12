/** @fileoverview Renders a stateful Solid fixture for browser loading and hot updates. */

import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import './styles.css'

/** Renders a button-driven counter with state local to the fixture component. */
function Counter() {
  const [count, setCount] = createSignal(0)

  return (
    <main>
      <h1>Engineering fixture</h1>
      <button onClick={() => setCount(count() + 1)}>Count: {count()}</button>
    </main>
  )
}

render(() => <Counter />, document.getElementById('root')!)
