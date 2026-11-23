import { entryRecoveryEvent } from './protocol'

function onEntryError(event: Event): void {
  if (!(event.target instanceof HTMLScriptElement) || event.target.type !== 'module') {
    return
  }
  window.removeEventListener('error', onEntryError, true)

  const observer = document.querySelector<HTMLScriptElement>('script[data-renderer-revision]')!
  const hot = import.meta.hot!
  hot.on(entryRecoveryEvent, () => location.reload())
  hot.send(entryRecoveryEvent, Number(observer.dataset.rendererRevision))
}

window.addEventListener('error', onEntryError, true)
window.addEventListener(
  'DOMContentLoaded',
  () => window.removeEventListener('error', onEntryError, true),
  {
    once: true,
  },
)
