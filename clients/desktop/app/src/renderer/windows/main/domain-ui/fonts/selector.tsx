import { createMemo, Show } from 'solid-js'
import { Combobox, type ComboboxOption } from '@kisaki3/desktop-ui/combobox'
import type { FontRef } from '@kisaki3/desktop-contracts/fonts'
import { createFontOptions } from './options'
import { Button } from '@kisaki3/desktop-ui/button'
import { QueryError } from '../../../../infrastructure/query/error'
import type { MainClient } from '../../../../infrastructure/api'

type FontSelection<F extends 'default' | 'document'> = FontRef | { readonly type: F }

interface FontOption<F extends 'default' | 'document'> extends ComboboxOption {
  ref?: FontSelection<F>
}

function fontKey<F extends 'default' | 'document'>(ref: FontSelection<F>) {
  if ('id' in ref) {
    return 'user:' + ref.id
  }
  if ('family' in ref) {
    return 'system:' + ref.family
  }
  return ref.type
}

export function FontSelector<F extends 'default' | 'document'>(props: {
  fallback: F
  value: FontSelection<F> | undefined
  api: MainClient
  onValueChange: (value: FontSelection<F>) => void
}) {
  const { api } = props
  const { t } = api
  let trigger!: HTMLButtonElement
  let viewport: HTMLDivElement | undefined
  const catalog = createFontOptions(api, () => {
    const ref = props.value
    return ref && ('id' in ref || 'family' in ref) ? ref : undefined
  })
  const fallbackName = () =>
    t(props.fallback === 'document' ? 'fonts.selector.document' : 'fonts.selector.default')
  const options = createMemo<FontOption<F>[]>(() => {
    const needle = catalog.search().trim().toLowerCase()
    const matches = (label: string) => label.toLowerCase().includes(needle)
    const fallback: FontOption<F> = {
      value: props.fallback,
      ref: { type: props.fallback },
      label: fallbackName(),
    }
    return [
      ...(matches(fallback.label) ? [fallback] : []),
      ...(catalog.page()?.items ?? []).map(({ id, name }) => ({
        value: 'user:' + id,
        ref: { type: 'user' as const, id },
        label: name,
        group: t('fonts.selector.user'),
      })),
      ...(catalog.system() ?? []).filter(matches).map((family) => ({
        value: 'system:' + family,
        ref: { type: 'system' as const, family },
        label: family,
        group: t('fonts.selector.system'),
      })),
    ]
  })
  const selected = () => {
    const ref = props.value
    const key = ref ? fontKey(ref) : 'unavailable'
    if (ref?.type === props.fallback) {
      return { value: key, label: fallbackName() }
    }
    if (ref && 'family' in ref) {
      const families = catalog.system()
      const label =
        !families || families.includes(ref.family)
          ? ref.family
          : t('controls.feedback.unavailableResource', { name: ref.family })
      return { value: key, label }
    }
    if (ref && 'id' in ref) {
      const resolved = catalog.selected()
      if (resolved?.id === ref.id) {
        const label = resolved.name ?? t('controls.feedback.unavailableResource', { name: ref.id })
        return { value: key, label }
      }
      const listed = catalog.page()?.items.find((item) => item.id === ref.id)
      const label =
        listed?.name ?? (catalog.selectionError() ? ref.id : t('fonts.selector.loading'))
      return { value: key, label }
    }
    return { value: key, label: t('controls.feedback.unavailable') }
  }

  function changePage(start: number) {
    if (viewport) {
      viewport.scrollTop = 0
    }
    trigger.focus({ preventScroll: true })
    catalog.setOffset(start)
  }

  return (
    <>
      <Combobox<FontOption<F>>
        ref={(node) => {
          trigger = node
        }}
        class="w-48 min-w-0 max-w-full flex-1"
        options={options()}
        value={selected()}
        query={catalog.search()}
        filter={false}
        onQueryChange={catalog.changeSearch}
        onOpenChange={catalog.changeOpen}
        loading={catalog.loading()}
        listFooter={
          <>
            <QueryError
              error={catalog.error()}
              retryLabel={t('actions.retry')}
              retry={catalog.retry}
            />
            <Show when={catalog.page()}>
              {(page) => (
                <Show when={page().total > catalog.pageSize}>
                  <div class="flex shrink-0 items-center gap-2 border-t border-border px-2 py-1">
                    <span class="grow text-xs">
                      {t('fonts.selector.range', {
                        first: page().start + 1,
                        last: page().start + page().items.length,
                        total: page().total,
                      })}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!page().start}
                      onClick={() => changePage(page().start - catalog.pageSize)}
                    >
                      {t('actions.previous')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={page().start + page().items.length >= page().total}
                      onClick={() => changePage(page().start + catalog.pageSize)}
                    >
                      {t('actions.next')}
                    </Button>
                  </div>
                </Show>
              )}
            </Show>
          </>
        }
        searchLabel={t('controls.search.label')}
        clearSearchLabel={t('controls.search.clear')}
        listClass="w-72"
        virtual
        listRef={(node) => {
          viewport = node
        }}
        emptyMessage={catalog.error() ? null : t('fonts.selector.empty')}
        loadingMessage={t('fonts.selector.loading')}
        invalidSelectionMessage={t('controls.feedback.unavailable')}
        onValueChange={(option) => {
          if (option?.ref) {
            props.onValueChange(option.ref)
          }
        }}
      />
      <Show when={!catalog.open()}>
        <QueryError error={catalog.error()} retryLabel={t('actions.retry')} retry={catalog.retry} />
      </Show>
    </>
  )
}
