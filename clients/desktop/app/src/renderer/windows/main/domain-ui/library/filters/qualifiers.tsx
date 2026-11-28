import { For, Show } from 'solid-js'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import type { EntryRef, PartType, EntryRule } from '@kisaki3/desktop-contracts/library'
import { partTypes, partWorkType, workTypes } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { Choice, Multiple, EntryOperands } from './controls'
import { Operands } from './operands'
import {
  list,
  object,
  newBody,
  updateObject,
  qualifiers,
  qualifierValues,
  operators,
  type Draft,
  type Field,
  type Op,
} from './model'

export function PartScope(props: {
  api: MainClient
  types: EntryRule['types']
  scope: Draft
  measure: string
  change: (scope: Draft, measure: string) => void
}) {
  const t = props.api.t
  const kind = () => props.scope.partType as PartType,
    classification = () => object(props.scope.classification)
  const classes = () =>
    kind() === 'animeEpisode'
      ? (['regular', 'special', null] as const)
      : (['opening', 'ending', 'promotion', 'interview', 'other', null] as const)
  const setClass = (change: Draft | undefined) =>
    props.change(updateObject(props.scope, { classification: change }), props.measure)
  return (
    <>
      <Choice
        t={t}
        label={t('library.ruleEditor.kind')}
        values={partTypes.filter((k) => props.types.some((v) => v === partWorkType(k)))}
        value={kind()}
        name={(v) => t(`library.parts.${v}`)}
        change={(k) => props.change({ partType: k }, props.measure)}
      />
      <Choice
        t={t}
        label={t('library.criteria.count')}
        values={['registered', 'completed', 'withFiles', 'accessible'] as const}
        value={props.measure as 'registered'}
        name={(v) => t(`library.criteria.${v}`)}
        change={(v) => props.change(props.scope, v)}
      />
      <Show when={kind() === 'animeEpisode' || kind() === 'animeExtra'}>
        <Choice
          t={t}
          label={t('library.ruleEditor.subtype')}
          values={['unset', 'in', 'notIn'] as const}
          value={(classification().op ?? 'unset') as 'unset'}
          name={(v) => t(`library.criteria.${v}`)}
          change={(v) =>
            setClass(v === 'unset' ? undefined : { op: v, values: list(classification().values) })
          }
        />
        <Show when={props.scope.classification}>
          <Multiple
            options={classes()}
            value={list<ReturnType<typeof classes>[number]>(classification().values)}
            name={(v) => (v ? t(`library.ruleEditor.${v}`) : t('library.criteria.unset'))}
            change={(values) => setClass({ ...classification(), values })}
          />
        </Show>
      </Show>
    </>
  )
}
export function Qualifiers(props: {
  api: MainClient
  field: Field
  where: Draft
  change: (v: Draft) => void
}) {
  const { api } = props,
    t = api.t
  const set = (key: string, value: unknown) =>
    props.change(updateObject(props.where, { [key]: value }))
  const keys = () =>
    props.field === 'completions'
      ? ['completedDate', 'note']
      : ['note', ...(qualifiers[props.field as keyof typeof qualifiers] ?? [])]
  function initial(key: string) {
    if (key === 'note') {
      return newBody('present')
    }
    if (key === 'completedDate') {
      return newBody('absoluteRange')
    }
    if (key === 'character') {
      return { type: 'oneOf', refs: [] }
    }
    return []
  }
  const name = (category: string, v: string | null) => {
    if (v === null) {
      return t('library.criteria.unset')
    }
    if (category === 'workTypes') {
      return t(`library.types.${v as 'game'}`)
    }
    return t(`library.roles.${v as 'main'}`)
  }
  return (
    <details class="rounded border border-border p-2">
      <summary class="cursor-pointer text-sm">{t('library.criteria.where')}</summary>
      <div class="mt-2 space-y-3">
        <For each={keys()}>
          {(key) => {
            const value = () => object(props.where[key]),
              op = () => value().op as Op
            return (
              <div class="space-y-2">
                <label class="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Object.hasOwn(props.where, key)}
                    onCheckedChange={(on) => set(key, on ? initial(key) : undefined)}
                  />
                  {t(`library.criteria.${key as 'note'}`)}
                </label>
                <Show when={Object.hasOwn(props.where, key)}>
                  <Show when={key === 'note' || key === 'completedDate'}>
                    <Choice
                      t={t}
                      label={t('library.criteria.op')}
                      values={
                        key === 'note'
                          ? (['present', 'absent', 'equals', 'contains'] as const)
                          : operators.releaseDate
                      }
                      value={op()}
                      name={(v) => t(`library.criteria.${v}`)}
                      change={(v) => set(key, newBody(v))}
                    />
                    <Operands
                      api={api}
                      field={key === 'note' ? 'description' : 'releaseDate'}
                      body={value()}
                      op={op()}
                      change={(v) => set(key, v)}
                    />
                  </Show>
                  <Show when={key === 'character'}>
                    <Choice
                      t={t}
                      label={t('library.criteria.character')}
                      values={
                        props.field === 'workCharacterPersons'
                          ? (['any', 'oneOf'] as const)
                          : (['none', 'any', 'oneOf'] as const)
                      }
                      value={value().type as 'oneOf'}
                      name={(v) => t(`library.criteria.${v}`)}
                      change={(v) => set(key, v === 'oneOf' ? { type: v, refs: [] } : { type: v })}
                    />
                    <Show when={value().type === 'oneOf'}>
                      <EntryOperands
                        api={api}
                        types={['character']}
                        value={list<EntryRef>(value().refs)}
                        change={(refs) => set(key, { type: 'oneOf', refs })}
                      />
                    </Show>
                  </Show>
                  <Show when={key === 'works'}>
                    <EntryOperands
                      api={api}
                      types={workTypes}
                      value={list<EntryRef>(props.where[key])}
                      change={(refs) => set(key, refs)}
                    />
                  </Show>
                  <Show when={qualifierValues[key as keyof typeof qualifierValues]}>
                    {(values) => (
                      <Multiple
                        options={values()}
                        value={list<string | null>(props.where[key])}
                        name={(v) => name(key, v)}
                        change={(v) => set(key, v)}
                      />
                    )}
                  </Show>
                </Show>
              </div>
            )
          }}
        </For>
      </div>
    </details>
  )
}
