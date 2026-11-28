import { MarkdownPreview } from '@kisaki3/desktop-ui/markdown'
import type { MainClient } from '../../../../../infrastructure/api'
import { createViewQuery } from '../../../../../infrastructure/query'
import { reportError } from '../../../../../infrastructure/notifications'

export function SavedMarkdown(props: { api: MainClient; value: string }) {
  const read = createViewQuery(async (signal) => {
    const ids = await props.api.request(signal, 'library.images.inMarkdown', props.value)
    const urls = new Map<string, string>()
    await Promise.all(
      ids.map(async (id) => {
        const opened = await props.api.call('library.images.open', id)
        const release = () =>
          void props.api.call('resources.release', opened.hold).catch(reportError)
        if (signal.aborted) {
          release()
          return
        }
        signal.addEventListener('abort', release, { once: true })
        urls.set('attachment:' + id, opened.url)
      }),
    )
    return urls
  })
  return (
    <MarkdownPreview
      value={props.value}
      onNavigate={(href) =>
        void props.api.call('library.openExternalLink', href).catch(reportError)
      }
      resolveImage={(source) => read.result()?.value?.get(source)}
    />
  )
}
