import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Application } from '../../../compose'
import { rpcData } from '../../../../../shared/window-api/protocol'
import { windowMethod } from '../../admission'
import { clipboard, shell } from 'electron'
import { applicationIdentities } from '@kisaki3/desktop-contracts/app'
import { format as formatLink } from '@kisaki3/desktop-contracts/deeplink'
import { parseEntryRef, parseEntryCreate } from '@kisaki3/desktop-contracts/library'
import { parseNativeViewTarget, type EntryViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { PreparedInput } from './images'
export function entryMethods(app: Application, entryInput: PreparedInput) {
  const { entries } = app.library
  return {
    'library.entries.locateTarget': windowMethod('read', async ([raw]) => {
      const target = parseNativeViewTarget(raw)
      if (target.type !== 'entry') {
        throw new DesktopError('InvalidInput', 'Choose an entry target')
      }
      return rpcData(await entries.locateTarget(target))
    }),
    'library.entries.organizers': windowMethod('read', async ([ref, spoilers]) =>
      rpcData(await entries.organizers(ref, spoilers === true)),
    ),
    'library.entries.get': windowMethod('read', async ([ref]) =>
      rpcData(await entries.get(parseEntryRef(ref))),
    ),
    'library.openExternalLink': windowMethod('control', async ([href]) => {
      if (typeof href !== 'string' || !URL.canParse(href)) {
        throw new DesktopError('InvalidInput', 'Invalid external link')
      }
      const url = new URL(href)
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) {
        throw new DesktopError('InvalidInput', 'Choose a web or email link')
      }
      await shell.openExternal(url.href)
    }),
    'library.entries.copyLink': windowMethod('control', ([raw]) => {
      const ref = parseEntryRef(raw)
      const target = {
        type: 'entry',
        entryType: ref.type,
        identifier: { type: 'local', id: ref.id },
      } as EntryViewTarget
      return clipboard.writeText(
        formatLink({
          scheme: applicationIdentities[app.paths.isolated ? 'development' : 'production'].scheme,
          type: 'view',
          target,
        }),
      )
    }),
    'library.entries.resolveRefs': windowMethod('read', async ([refs]) =>
      rpcData(await entries.resolveRefs(refs)),
    ),
    'library.entries.getDescription': windowMethod('read', ([ref]) => entries.getDescription(ref)),
    'library.entries.findByExternalIdentity': windowMethod('read', async ([identity]) =>
      rpcData(await entries.findByExternalIdentity(identity)),
    ),
    'library.entries.list': windowMethod('read', async ([query, options]) =>
      rpcData(await entries.list(query, options)),
    ),
    'library.entries.groups': windowMethod('read', async ([query]) =>
      rpcData(await entries.groups(query, { type: 'collections' })),
    ),
    'library.entries.locateInGroups': windowMethod('read', async ([query, ref, group]) =>
      rpcData(await entries.locateInGroups(query, ref, group)),
    ),
    'library.entries.updateMany': windowMethod('write', ([values], signal) => {
      if (!Array.isArray(values)) {
        throw new DesktopError('InvalidInput', 'Expected multiple entry edits')
      }
      return entries.updateMany(
        values.map((value) => entryInput(value, [])),
        { signal },
      )
    }),
    'library.entries.locate': windowMethod('read', async ([query, ref, options]) =>
      rpcData(await entries.locate(query, ref, options)),
    ),
    'library.entries.selectRefs': windowMethod('read', async ([query, selection]) =>
      rpcData(await entries.selectRefs(query, selection)),
    ),
    'library.entries.create': windowMethod('write', async ([raw, ids], signal) =>
      rpcData(await entries.create(parseEntryCreate(entryInput(raw, ids)), { signal })),
    ),
    'library.entries.update': windowMethod('write', ([raw, ids], signal) => {
      const value = entryInput(raw, ids)
      if (!('ref' in value)) {
        throw new DesktopError('InvalidInput', 'Choose an entry to edit')
      }
      const { ref, ...input } = value
      return entries.update(ref, input, { signal })
    }),
    'library.entries.setEvaluation': windowMethod('write', ([ref, raw], signal) =>
      entries.setEvaluation(ref, raw, { signal }),
    ),
    'library.entries.setWorkStatus': windowMethod('write', ([ref, raw], signal) =>
      entries.setWorkStatus(ref, raw, { signal }),
    ),
  }
}
