import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../../infrastructure/api'
import { browseQuery } from '../../domain-ui/library/query'
import type { LibraryPage } from './navigation'

export async function libraryTarget(
  api: MainClient,
  target: NativeViewTarget,
  signal: AbortSignal,
): Promise<LibraryPage | undefined> {
  const missing = () => new DesktopError('NotFound', api.t('controls.feedback.unavailable'))
  switch (target.type) {
    case 'library':
      return { kind: 'showcase' }
    case 'entries':
      return {
        kind: 'entries',
        query: browseQuery({ type: 'library' }, [target.entryType]),
        title: api.t(`library.types.${target.entryType}`),
      }
    case 'entry': {
      const located = await api.request(signal, 'library.entries.locateTarget', target)
      return { kind: 'entry', entry: located.entry, location: located }
    }
    case 'collection':
    case 'tag': {
      if (!target.id) {
        return { kind: target.type === 'tag' ? 'tags' : 'collections' }
      }
      const row =
        target.type === 'tag'
          ? await api.request(signal, 'library.tags.get', target.id)
          : await api.request(signal, 'library.collections.get', target.id)
      if (!row) {
        throw missing()
      }
      return {
        kind: 'entries',
        query: browseQuery({ type: target.type, id: target.id }),
        title: row.name,
      }
    }
    case 'note':
      if (target.id && !(await api.request(signal, 'library.notes.get', target.id))) {
        throw missing()
      }
      return { kind: 'notes', ...(target.id && { id: target.id }) }
    case 'annotation':
      if (!(await api.request(signal, 'library.annotations.get', target.ref))) {
        throw missing()
      }
      return { kind: 'annotations', ref: target.ref }
    case 'about':
    case 'extensions':
    case 'fonts':
    case 'metadataProfiles':
    case 'onboarding':
    case 'preferences':
    case 'scanner':
    case 'sessions.recordings':
    case 'systemIntegration':
    case 'tasks':
    case 'themes':
    case 'updates':
      return undefined
  }
}
