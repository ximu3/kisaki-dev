import { getOwner, isDisposed, createMemo, createSignal, onCleanup } from 'solid-js'
import type { Font } from '@kisaki3/desktop-contracts/fonts'
import type { FontChoice, FontFileChoice } from '../../../../../shared/window-api'
import type { MainClient } from '../../../../infrastructure/api'
import { fileInput } from '../../../../infrastructure/file-input'
import { errorMessage, reportError } from '../../../../infrastructure/notifications'

type FileDraft = { key: number; name: string } & (
  | { status: 'pending' }
  | { status: 'ready'; file: FontChoice }
  | { status: 'failed'; error: string }
)

export function createFontDraft(api: MainClient, initial: Font | null) {
  const [original, setOriginal] = createSignal(initial)
  const [name, setName] = createSignal(initial?.name ?? '')
  const [kept, setKept] = createSignal(initial?.files.map((file) => file.attachmentId) ?? [])
  const [files, setFiles] = createSignal<readonly FileDraft[]>([])
  const [choosing, setChoosing] = createSignal(false)
  const preparing = () => choosing() || files().some((file) => file.status === 'pending')
  const added = createMemo(() => files().filter((file) => file.status === 'ready'))
  const dirty = () =>
    choosing() ||
    files().length > 0 ||
    name() !== (original()?.name ?? '') ||
    kept().length !== (original()?.files.length ?? 0)

  const owner = getOwner()!
  let nameEdited = false
  let nextKey = 0
  let submitted: readonly FontChoice[] = []
  const owned = new Set<FontChoice>()

  async function release(file: FontChoice) {
    if (owned.delete(file)) {
      await api.call('resources.release', file.id)
    }
  }
  onCleanup(() => {
    for (const file of owned) {
      if (!submitted.includes(file)) {
        void release(file).catch(reportError)
      }
    }
  })

  function adopt(key: number, result: FontFileChoice) {
    if ('file' in result) {
      owned.add(result.file)
      if (isDisposed(owner)) {
        void release(result.file).catch(reportError)
        return
      }
      if (!nameEdited) {
        setName((current) => current || result.file.metadata.faces[0].family)
      }
    }
    if (!isDisposed(owner)) {
      const outcome: FileDraft =
        'file' in result
          ? { key, ...result, status: 'ready' }
          : { key, ...result, status: 'failed' }
      setFiles((items) =>
        items.some((item) => item.key === key)
          ? items.map((item) => (item.key === key ? outcome : item))
          : [...items, outcome],
      )
    }
  }

  async function choose() {
    setChoosing(true)
    try {
      const selected = await api.call('fonts.choose')
      for (const result of selected ?? []) {
        adopt(nextKey++, result)
      }
    } finally {
      if (!isDisposed(owner)) {
        setChoosing(false)
      }
    }
  }

  async function receive(incoming: readonly File[]) {
    const work = incoming.map((file) => ({ file, key: nextKey++ }))
    setFiles((items) => [
      ...items,
      ...work.map(({ file, key }) => ({ key, name: file.name, status: 'pending' as const })),
    ])
    for (const { file, key } of work) {
      if (isDisposed(owner)) {
        return
      }
      try {
        const input = await fileInput(file)
        try {
          if (!isDisposed(owner)) {
            const prepared = await api.call('fonts.prepareInput', input.id)
            adopt(key, { name: file.name, file: prepared })
          }
        } finally {
          input.dispose()
        }
      } catch (cause) {
        adopt(key, { name: file.name, error: errorMessage(cause) })
      }
    }
  }

  function remove(key: number) {
    const entry = files().find((item) => item.key === key)
    setFiles((items) => items.filter((item) => item !== entry))
    if (entry?.status === 'ready' && !submitted.includes(entry.file)) {
      void release(entry.file).catch(reportError)
    }
  }

  function rename(value: string) {
    nameEdited = true
    setName(value)
  }

  function toggle(id: string) {
    setKept((ids) => (ids.includes(id) ? ids.filter((key) => key !== id) : [...ids, id]))
  }

  async function save() {
    const old = original()
    const sentName = name()
    const retained =
      old?.files.map((file) => file.attachmentId).filter((id) => kept().includes(id)) ?? []
    const addedFiles = added()
    const sent = addedFiles.map((entry) => entry.file)
    submitted = sent
    let committed = false

    try {
      const ids = sent.map((file) => file.id)
      const result = old
        ? await api.call('fonts.editFiles', old.id, sentName, retained, ids, old)
        : await api.call('fonts.import', sentName, ids)
      committed = true
      if (!isDisposed(owner)) {
        setOriginal(result)
        setKept(result.files.map((file) => file.attachmentId))
        setFiles((current) =>
          current.filter((entry) => !addedFiles.some(({ key }) => key === entry.key)),
        )
      }
      return result
    } finally {
      submitted = []
      const retryable =
        !isDisposed(owner) && !committed ? new Set(added().map((entry) => entry.file)) : undefined
      await Promise.all(
        sent
          .filter((file) => !retryable?.has(file))
          .map((file) => release(file).catch(reportError)),
      )
    }
  }

  return {
    original,
    name,
    rename,
    kept,
    files,
    choosing,
    preparing,
    dirty,
    count: () => kept().length + added().length,
    failed: () => files().some((file) => file.status === 'failed'),
    choose,
    receive,
    remove,
    toggle,
    save,
  }
}
