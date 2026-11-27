import { createEffect, createMemo, createSignal, onSettled, type Accessor } from 'solid-js'
import type { FontRef } from '@kisaki3/desktop-contracts/fonts'
import type { MainClient } from '../../../../infrastructure/api'
import { createViewQuery } from '../../../../infrastructure/query'

const pageSize = 50

export function createFontOptions(api: MainClient, selection: Accessor<FontRef | undefined>) {
  const [open, setOpen] = createSignal(false)
  const [search, setSearch] = createSignal('')
  const [offset, setOffset] = createSignal(0)
  const term = createMemo(() => search().trim())
  const users = createViewQuery(async (signal) => {
    if (!open()) {
      return
    }
    const text = term()
    const start = offset()
    const page = await api.request(signal, 'fonts.list', text, { offset: start, limit: pageSize })
    return { text, start, ...page }
  })
  const page = () => {
    const value = users.result()?.value
    return value?.text === term() && value.start === offset() ? value : undefined
  }
  createEffect(page, (value) => {
    if (value && value.start > 0 && value.start >= value.total) {
      setOffset(Math.max(0, Math.ceil(value.total / pageSize) - 1) * pageSize)
    }
  })

  const userId = createMemo(() => {
    const ref = selection()
    return ref?.type === 'user' ? ref.id : undefined
  })
  const selected = createViewQuery(async (signal) => {
    const id = userId()
    if (id) {
      const name = await api.request(signal, 'fonts.name', id)
      return { id, name }
    }
  })
  const needsSystem = createMemo(() => open() || selection()?.type === 'system')
  const system = createViewQuery((signal) =>
    needsSystem() ? api.request(signal, 'fonts.system') : undefined,
  )

  function refresh() {
    if (open()) {
      void users.reload()
    }
    if (userId()) {
      void selected.reload()
    }
  }
  onSettled(() => {
    api.topics.addEventListener('fonts.changed', refresh)
    return () => api.topics.removeEventListener('fonts.changed', refresh)
  })

  function retry() {
    if (users.result()?.error) {
      void users.reload()
    }
    if (system.result()?.error) {
      void system.reload()
    }
    if (selected.result()?.error) {
      void selected.reload()
    }
  }
  function changeSearch(text: string) {
    setSearch(text)
    setOffset(0)
  }
  function changeOpen(value: boolean) {
    setOpen(value)
    if (!value) {
      changeSearch('')
    }
  }

  return {
    open,
    changeOpen,
    search,
    changeSearch,
    page,
    pageSize,
    setOffset,
    retry,
    selected: () => selected.result()?.value,
    selectionError: () => selected.result()?.error,
    system: () => system.result()?.value,
    loading: () => users.pending() || system.pending(),
    error: () => users.result()?.error ?? system.result()?.error ?? selected.result()?.error,
  }
}
