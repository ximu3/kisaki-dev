import {
  parseShowcaseFields,
  parseShowcaseUpdate,
  parseShowcaseCreateMany,
  parseReorderInput,
  type ShowcaseApi,
} from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { CompleteWrite } from '../transaction'
import type { showcaseStorage } from './storage'
import { showcasePresets } from './presets'

export function createShowcase(
  call: DatabaseCall<ReturnType<typeof showcaseStorage>>,
  complete: CompleteWrite,
  sensitive: () => boolean,
  language: () => { locale: string; t: Translate },
) {
  return {
    list: () => call('listShowcase'),
    get: (id) => call('getShowcase', id),
    async listPresets() {
      const { locale, t } = language()
      return showcasePresets(locale, t)
    },
    async create(input: unknown, context) {
      context?.signal?.throwIfAborted()
      return complete(await call('addSections', [parseShowcaseFields(input)], sensitive()))[0]!
    },
    async createMany(input: unknown, context) {
      context?.signal?.throwIfAborted()
      return complete(await call('addSections', parseShowcaseCreateMany(input), sensitive()))
    },
    async update(id, input: unknown, context) {
      context?.signal?.throwIfAborted()
      return complete(await call('editSection', id, parseShowcaseUpdate(input), sensitive()))
    },
    async delete(id, context) {
      context?.signal?.throwIfAborted()
      complete(await call('removeSection', id))
    },
    async reorder(input: unknown, context) {
      context?.signal?.throwIfAborted()
      complete(await call('arrangeSections', parseReorderInput(input)))
    },
  } satisfies ShowcaseApi
}
