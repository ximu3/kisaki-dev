import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '@kisaki3/ui'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'

function Counter() {
  const [count, setCount] = createSignal(0)
  return <Button onClick={() => setCount((value) => value + 1)}>Count {count()}</Button>
}

const root = document.getElementById('root')
if (!root) throw new Error('Consumer root is missing')
render(() => <Counter />, root)
