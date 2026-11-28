import { For, Show } from 'solid-js'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Select } from '@kisaki3/desktop-ui/select'
import type {
  PersonWork,
  WorkCharacter,
  WorkRef,
  EntryRef,
  GraphRelations,
  PersonWorkBinding,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { errorMessage } from '../../../../../infrastructure/notifications'
import { libraryRead } from '../../../domain-ui/library/read'

export interface CreditDecision {
  credit: PersonWork
  action: 'move' | 'remove'
}
export function creditChanges(
  selected: readonly CreditDecision[],
  work: WorkRef,
  character: EntryRef<'character'>,
): NonNullable<GraphRelations['personWorks']> {
  const result: {
    remove: string[]
    expected: { id: string; binding: PersonWorkBinding; isSpoiler: boolean; note: string | null }[]
    update: NonNullable<NonNullable<GraphRelations['personWorks']>['update']>[number][]
  } = { remove: [], expected: [], update: [] }
  for (const { credit, action } of selected) {
    const { id, isSpoiler, note, ...binding } = credit
    if (action === 'remove') {
      result.remove.push(id)
      result.expected.push({ id, binding, isSpoiler, note })
    } else {
      result.update.push({ id, changes: { work, character }, expected: { binding } })
    }
  }
  return result
}
export function CreditDecisions(props: {
  api: MainClient
  original: WorkCharacter
  spoilers: boolean
  selected: readonly CreditDecision[]
  change: (choices: readonly CreditDecision[]) => void
}) {
  const { api, original } = props,
    t = api.t
  const read = libraryRead(api, ['relations', 'entries'], async (signal) => {
    const credits: PersonWork[] = []
    for (let offset = 0; ; offset += 200) {
      const page = await api.request(
        signal,
        'library.relations.list',
        'personWorks',
        { side: 'character', characterId: original.character.id },
        { offset, limit: 200 },
        props.spoilers,
      )
      for (const row of page.items) {
        if ('person' in row && row.work.id === original.work.id) {
          credits.push(row)
        }
      }
      if (offset + page.items.length >= page.total) {
        break
      }
    }
    const names = new Map<string, string>()
    for (let i = 0; i < credits.length; i += 200) {
      for (const ref of await api.request(
        signal,
        'library.entries.resolveRefs',
        credits.slice(i, i + 200).map((credit) => credit.person),
      )) {
        names.set(ref.id, ref.name)
      }
    }
    return credits.map((credit) => ({
      credit,
      name: names.get(credit.person.id) ?? credit.person.id,
    }))
  })
  return (
    <>
      <Show when={read.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
      <Show when={read.result()?.value?.length}>
        <section class="space-y-2 border-t pt-3">
          <h3 class="text-sm font-medium">{t('library.relation.credits')}</h3>
          <For each={read.result()?.value}>
            {({ credit, name }) => (
              <Field>
                <FieldLabel>
                  {name} · {t(`library.roles.${credit.role}`)}
                </FieldLabel>
                <Select
                  value={
                    props.selected.find((item) => item.credit.id === credit.id)?.action ?? 'keep'
                  }
                  options={(['keep', 'move', 'remove'] as const).map((value) => ({
                    value,
                    label: t(`library.relation.${value}Credit`),
                  }))}
                  emptyMessage={t('controls.search.empty')}
                  invalidSelectionMessage={t('controls.feedback.unavailable')}
                  onValueChange={(action) => {
                    const rest = props.selected.filter((item) => item.credit.id !== credit.id)
                    props.change(
                      action === 'remove' || action === 'move'
                        ? [...rest, { credit, action }]
                        : rest,
                    )
                  }}
                />
              </Field>
            )}
          </For>
        </section>
      </Show>
    </>
  )
}
