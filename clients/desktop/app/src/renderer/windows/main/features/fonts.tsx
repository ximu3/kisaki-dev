/** @fileoverview Manages a file-backed user font collection and releases draft preparations when editing ends. */

import { createEffect, createResource, createSignal, For, Show, onCleanup } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import type { Font } from '@kisaki3/desktop-contracts/fonts'
import type { FontChoice } from '../../../../shared/window-api'
import type { MainClient } from '../../../infrastructure/api'
import { fileInput } from '../../../infrastructure/file-input'

/** Native font library with explicitly saved name and file-set edits. */
export function Fonts(props: {
  target?: string | undefined
  api: MainClient
  onSave: (save: () => Promise<void>) => void
  dirty: (value: boolean) => void
  report: (error: unknown) => void
}) {
  const { api } = props
  /** Holds the user font-name search in this instance. */
  const [search, setSearch] = createSignal('')
  /** Tracks the current interval of matching library rows. */
  const [offset, setOffset] = createSignal(0)
  /** Reads the requested font interval and its total. */
  const [list, { refetch }] = createResource(
    () => ({ search: search(), offset: offset() }),
    (query) => api.call('fonts.list', query.search, { offset: query.offset, limit: 50 }),
  )
  /** Distinguishes browsing, creating and editing an existing font. */
  const [font, setFont] = createSignal<Font | null>()
  /** Owns the unsaved display name. */
  const [name, setName] = createSignal('')
  /** Holds verified input files acquired for the current edit. */
  const [added, setAdded] = createSignal<readonly FontChoice[]>([])
  /** Tracks which original attachments the submitted file set retains. */
  const [kept, setKept] = createSignal<string[]>([])
  /** Disables a second save while the complete edit is committing. */
  const [busy, setBusy] = createSignal(false)
  /** Rereads the catalog after independent font changes. */
  const changed = () => void refetch()
  api.topics.addEventListener('fonts.changed', changed)
  /** Releases all remaining file preparations from this draft. */
  const release = () => {
    const files = added()
    setAdded([])
    return Promise.all(files.map((file) => api.call('resources.release', file.id)))
  }
  onCleanup(() => {
    api.topics.removeEventListener('fonts.changed', changed)
    void release().catch(props.report)
  })
  /** Opens a fresh edit from one saved font or an empty import. */
  const open = async (id: string | null) => {
    const value = id ? await api.call('fonts.get', id) : null
    if (id && !value) {
      throw new Error(api.t('runtime.unavailable'))
    }
    setFont(value)
    setName(value?.name ?? '')
    setKept(value?.files.map((f) => f.attachmentId) ?? [])
    props.dirty(false)
  }
  let editing = true
  onCleanup(() => {
    editing = false
  })
  createEffect(() => {
    const id = props.target
    if (id) {
      void open(id).catch(props.report)
    }
  })
  /** Keeps verified files in this draft or releases a late result after the editor closes. */
  const add = (choices: readonly FontChoice[]) => {
    if (!editing) {
      for (const file of choices) {
        void api.call('resources.release', file.id).catch(props.report)
      }
      return
    }
    setAdded([...added(), ...choices])
    if (!name()) {
      setName(choices[0]?.metadata.faces[0].family ?? '')
    }
    props.dirty(true)
  }
  /** Uses the native picker and retains its verified selections. */
  const choose = async () => {
    const choices = await api.call('fonts.choose')
    if (choices) {
      add(choices)
    }
  }
  /** A real drop or clipboard File supplies its own bytes through the document's binary port. */
  async function receive(files: FileList) {
    if (font() === undefined) {
      await open(null)
    }
    for (const file of files) {
      const source = await fileInput(file)
      try {
        add([await api.call('fonts.prepareInput', source.id)])
      } finally {
        source.dispose()
      }
    }
  }
  /** Submits one complete font edit and releases the accepted draft. */
  const save = async () => {
    setBusy(true)
    try {
      const old = font()
      if (old) {
        await api.call(
          'fonts.editFiles',
          old.id,
          name(),
          kept(),
          added().map((f) => f.id),
          old,
        )
      } else {
        await api.call(
          'fonts.import',
          name(),
          added().map((f) => f.id),
        )
      }
      await release()
      props.dirty(false)
      setFont(undefined)
    } finally {
      setBusy(false)
    }
  }
  props.onSave(save)
  return (
    <section
      class="management"
      onDragOver={(event) => {
        if (event.dataTransfer?.types.includes('Files')) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (event.dataTransfer?.files.length) {
          void receive(event.dataTransfer.files).catch(props.report)
        }
      }}
      onPaste={(event) => {
        if (event.clipboardData?.files.length) {
          event.preventDefault()
          void receive(event.clipboardData.files).catch(props.report)
        }
      }}
    >
      <Show
        when={font() !== undefined}
        fallback={
          <>
            <header class="page-heading">
              <h2>{api.t('runtime.fonts')}</h2>
              <Button onClick={() => void open(null)}>{api.t('runtime.newFont')}</Button>
            </header>
            <input
              type="search"
              aria-label={api.t('runtime.fields.search')}
              value={search()}
              onInput={(e) => {
                setSearch(e.currentTarget.value)
                setOffset(0)
              }}
            />
            <Show
              when={list()?.items.length}
              fallback={<p class="empty">{api.t('runtime.emptyFonts')}</p>}
            >
              <For each={list()?.items}>
                {(item) => (
                  <div class="setting">
                    <strong>{item.name}</strong>
                    <div class="tool-row">
                      <Button
                        variant="outline"
                        onClick={() => void open(item.id).catch(props.report)}
                      >
                        {api.t('actions.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (confirm(api.t('runtime.removeConfirm'))) {
                            void api.call('fonts.delete', item.id).catch(props.report)
                          }
                        }}
                      >
                        {api.t('actions.delete')}
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
            <Show when={(list()?.total ?? 0) > 50}>
              <Button disabled={!offset()} onClick={() => setOffset(offset() - 50)}>
                {api.t('runtime.previous')}
              </Button>
              <Button
                disabled={offset() + 50 >= (list()?.total ?? 0)}
                onClick={() => setOffset(offset() + 50)}
              >
                {api.t('runtime.next')}
              </Button>
            </Show>
          </>
        }
      >
        <label class="setting">
          {api.t('runtime.name')}
          <input
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value)
              props.dirty(true)
            }}
          />
        </label>
        <h3>{api.t('runtime.files')}</h3>
        <For each={font()?.files.filter((f) => kept().includes(f.attachmentId))}>
          {(file) => (
            <div class="setting">
              {file.metadata.faces[0].fullName}
              <Button
                onClick={() => {
                  setKept(kept().filter((id) => id !== file.attachmentId))
                  props.dirty(true)
                }}
              >
                {api.t('runtime.remove')}
              </Button>
            </div>
          )}
        </For>
        <For each={added()}>
          {(file) => (
            <div class="setting">
              <FontPreview file={file} report={props.report} />
              <Button
                onClick={() => {
                  setAdded(added().filter((f) => f !== file))
                  void api.call('resources.release', file.id).catch(props.report)
                }}
              >
                {api.t('runtime.remove')}
              </Button>
            </div>
          )}
        </For>
        <Button variant="outline" onClick={() => void choose().catch(props.report)}>
          {api.t('runtime.choose')}
        </Button>
        <footer>
          <Button
            variant="ghost"
            onClick={() => {
              void release().catch(props.report)
              props.dirty(false)
              setFont(undefined)
            }}
          >
            {api.t('actions.cancel')}
          </Button>
          <Button
            disabled={busy() || !name().trim() || (!kept().length && !added().length)}
            onClick={() => void save().catch(props.report)}
          >
            {api.t('actions.save')}
          </Button>
        </footer>
      </Show>
    </section>
  )
}

/** Loads a verified font into this document only for the lifetime of its preview row. */
function FontPreview(props: { file: FontChoice; report: (error: unknown) => void }) {
  const family = 'Kisaki-preview-' + props.file.id
  const face = new FontFace(family, 'url(' + JSON.stringify(props.file.url) + ')')
  /** Enables the sample face only after this document has loaded it. */
  const [ready, setReady] = createSignal(false)
  let active = true
  void face
    .load()
    .then((loaded) => {
      if (active) {
        document.fonts.add(loaded)
        setReady(true)
      }
    })
    .catch(props.report)
  onCleanup(() => {
    active = false
    document.fonts.delete(face)
  })
  return (
    <span style={{ 'font-family': ready() ? family : undefined }}>
      {props.file.metadata.faces[0].fullName ?? props.file.metadata.faces[0].family} · Aa 0123 あ 字
    </span>
  )
}
