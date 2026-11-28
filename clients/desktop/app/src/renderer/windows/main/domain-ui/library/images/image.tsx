import { Show } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { reportError } from '../../../../../infrastructure/notifications'
import { createViewQuery } from '../../../../../infrastructure/query'

export function LibraryImage(props: { api: MainClient; id: string; class: string; alt: string }) {
  const source = createViewQuery(async (signal) => {
    const image = await props.api.call('library.images.open', props.id)
    function release() {
      void props.api.call('resources.release', image.hold).catch(reportError)
    }
    if (signal.aborted) {
      release()
      return
    }
    signal.addEventListener('abort', release, { once: true })
    return image.url
  })
  return (
    <Show when={source.result()?.value}>
      {(url) => <img class={props.class} src={url()} alt={props.alt} draggable={false} />}
    </Show>
  )
}
