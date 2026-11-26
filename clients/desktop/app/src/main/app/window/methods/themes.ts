import {
  parseThemeRef,
  parseUserThemeCreate,
  parseUserThemeUpdate,
  parseAppearancePreviewInput,
  type AppearancePreview,
} from '@kisaki3/desktop-contracts/appearance'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { rpcData } from '../../../../shared/window-api/protocol'
import type { Application } from '../../compose'
import type { DocumentResources } from '../resources'
import { textArgument } from '../values'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createThemeMethods(
  appearance: Application['appearance'],
  resources: DocumentResources,
  locale: () => string,
  notifyEnded: (request: string) => void,
): WindowMethodGroup<'themes'> {
  const previews = new Map<string, AppearancePreview>()

  return {
    'themes.list': windowMethod('read', async (_, signal) =>
      rpcData(await appearance.themes.listForLocale(locale(), { signal })),
    ),
    'themes.get': windowMethod('read', async ([ref], signal) =>
      rpcData(await appearance.themes.get(parseThemeRef(ref), { signal })),
    ),
    'themes.clone': windowMethod('write', async ([ref, name], signal) =>
      rpcData(
        await appearance.themes.clone(parseThemeRef(ref), { name: textArgument(name) }, { signal }),
      ),
    ),
    'themes.create': windowMethod('write', async ([input], signal) =>
      rpcData(await appearance.themes.create(parseUserThemeCreate(input), { signal })),
    ),
    'themes.update': windowMethod('write', async ([id, input], signal) =>
      appearance.themes.update(textArgument(id), parseUserThemeUpdate(input), { signal }),
    ),
    'themes.delete': windowMethod('write', async ([id], signal) =>
      appearance.themes.delete(textArgument(id), { signal }),
    ),
    'themes.preview': windowMethod('acquire', async ([request, input], signal) => {
      const owner = textArgument(request)
      const preview = await appearance.preview(parseAppearancePreviewInput(input), { signal })
      const id = await resources.keep(preview, signal, previews)

      preview.onDispose(() => {
        resources.forget(id)
        notifyEnded(owner)
      })
      return id
    }),
    'themes.updatePreview': windowMethod('acquire', async ([id, input]) => {
      const preview = previews.get(textArgument(id))
      if (!preview) {
        throw new DesktopError('InstanceExpired', 'This preview has ended')
      }
      await preview.update(parseAppearancePreviewInput(input))
    }),
  }
}
