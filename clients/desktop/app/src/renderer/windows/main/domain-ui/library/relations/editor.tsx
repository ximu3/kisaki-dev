import { createSignal, Show } from 'solid-js'
import { dequal } from 'dequal'
import {
  workTypes,
  characterRoles,
  personRoles,
  organizationRoles,
  workRelationTypes,
  canUsePersonRole,
  canUseOrganizationRole,
  canUseWorkRelation,
  isWorkType,
  parseWorkCharacterCreate,
  parsePersonWorkCreate,
  parseOrganizationWorkCreate,
  parseWorkRelationCreate,
  parseWorkCharacterUpdate,
  parsePersonWorkUpdate,
  parseOrganizationWorkUpdate,
  parseWorkRelationUpdate,
  type EntryRef,
  type WorkRef,
  type WorkCharacter,
  type EntryRule,
  type PersonRole,
  type OrganizationRole,
  type CharacterRole,
  type WorkRelationType,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Select } from '@kisaki3/desktop-ui/select'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { Switch } from '@kisaki3/desktop-ui/switch'
import type { LibraryFact } from '../../../../../../shared/window-api/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { EntryPicker } from '../entries/picker'
import { libraryRead } from '../read'
import type { RelationView } from './views'
import { CreditDecisions, creditChanges, type CreditDecision } from './credits'

export interface RelationEdit {
  spoilers?: boolean
  owner: EntryRef
  view: RelationView
  original?: LibraryFact
}
interface Endpoints {
  work: WorkRef | null
  person: EntryRef<'person'> | null
  character: EntryRef<'character'> | null
  organization: EntryRef<'organization'> | null
  from: WorkRef | null
  to: WorkRef | null
}
function endpoints(edit: RelationEdit): Endpoints {
  const old = edit.original
  const scope = edit.view.scope
  const work = isWorkType(edit.owner.type) ? { id: edit.owner.id, type: edit.owner.type } : null
  const refs: Endpoints = {
    work,
    person: null,
    character: null,
    organization: null,
    from: null,
    to: null,
  }
  if (old) {
    if ('from' in old) {
      return { ...refs, from: old.from, to: old.to }
    }
    refs.work = old.work
    if ('person' in old) {
      refs.person = old.person
    }
    if ('character' in old) {
      refs.character = old.character
    }
    if ('organization' in old) {
      refs.organization = old.organization
    }
  } else {
    if (scope.side === 'person') {
      refs.person = { type: 'person', id: scope.personId }
    }
    if (scope.side === 'character') {
      refs.character = { type: 'character', id: scope.characterId }
    }
    if (scope.side === 'organization') {
      refs.organization = { type: 'organization', id: scope.organizationId }
    }
    if (scope.side === 'from' || scope.side === 'to') {
      refs[scope.side] = work
    }
  }
  return refs
}
export function RelationEditor(props: {
  api: MainClient
  edit: RelationEdit | undefined
  close: () => void
}) {
  return (
    <EditorDialog edit={props.edit} size="md" onClose={props.close}>
      {(edit, controls) => (
        <FactForm
          api={props.api}
          edit={edit}
          close={controls.requestClose}
          saved={props.close}
          register={controls.registerEditor}
        />
      )}
    </EditorDialog>
  )
}
function FactForm(props: {
  api: MainClient
  edit: RelationEdit
  close: () => void
  saved: () => void
  register: (guard: EditorGuard) => void
}) {
  const { api, edit } = props,
    t = api.t
  const initial = endpoints(edit),
    old = edit.original,
    family = edit.view.family
  const [refs, setRefs] = createSignal(initial)
  const [credits, setCredits] = createSignal<readonly CreditDecision[]>([])
  const recasting = () =>
    family === 'workCharacters' &&
    old &&
    (!dequal(refs().work, initial.work) || !dequal(refs().character, initial.character))
      ? (old as WorkCharacter)
      : undefined

  function defaultRole() {
    if (old) {
      return 'from' in old ? old.type : old.role
    }
    if (family === 'workRelations') {
      return 'related'
    }
    return family === 'workCharacters' ? null : 'other'
  }
  const [role, setRole] = createSignal<string | null>(defaultRole())
  const initialRole = role()
  const [note, setNote] = createSignal(old?.note ?? '')
  const [spoiler, setSpoiler] = createSignal(old && 'isSpoiler' in old ? old.isSpoiler : false)
  const [picker, setPicker] = createSignal<{ key: keyof Endpoints; types: EntryRule['types'] }>()
  const names = libraryRead(api, ['entries', 'relations'], (signal) =>
    api.request(
      signal,
      'library.entries.resolveRefs',
      Object.values(refs()).filter((ref): ref is EntryRef => ref !== null),
    ),
  )
  const options = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  function endpoint(
    key: keyof Endpoints,
    label: string,
    types: EntryRule['types'],
    optional = false,
  ) {
    return (
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <div class="flex gap-2">
          <Button
            variant="outline"
            class="min-w-0 grow justify-start"
            onClick={() => setPicker({ key, types })}
          >
            {names.result()?.value?.find((item) => item.id === refs()[key]?.id)?.name ??
              t('library.browse.pick')}
          </Button>
          <Show when={optional && refs()[key]}>
            <Button
              variant="ghost"
              onClick={() => setRefs((current) => ({ ...current, [key]: null }))}
            >
              {t('actions.clear')}
            </Button>
          </Show>
        </div>
      </Field>
    )
  }
  function roles() {
    const r = refs()
    if (family === 'workCharacters') {
      return ['unknown', ...characterRoles] as const
    }
    if (family === 'personWorks') {
      return personRoles.filter((v) => !r.work || canUsePersonRole(v, r.work.type, !!r.character))
    }
    if (family === 'organizationWorks') {
      return organizationRoles.filter((v) => !r.work || canUseOrganizationRole(v, r.work.type))
    }
    return workRelationTypes.filter(
      (v) => !r.from || !r.to || canUseWorkRelation(v, r.from.type, r.to.type),
    )
  }
  function nextBinding() {
    const r = refs()
    switch (family) {
      case 'workCharacters':
        return { work: r.work, character: r.character, role: role() as CharacterRole | null }
      case 'personWorks':
        return {
          work: r.work,
          person: r.person,
          character: r.character,
          role: role() as PersonRole,
        }
      case 'organizationWorks':
        return { work: r.work, organization: r.organization, role: role() as OrganizationRole }
      case 'workRelations':
        return { from: r.from, to: r.to, type: role() as WorkRelationType }
    }
  }
  const parseCreate = {
    workCharacters: parseWorkCharacterCreate,
    personWorks: parsePersonWorkCreate,
    organizationWorks: parseOrganizationWorkCreate,
    workRelations: parseWorkRelationCreate,
  }
  const parseUpdate = {
    workCharacters: parseWorkCharacterUpdate,
    personWorks: parsePersonWorkUpdate,
    organizationWorks: parseOrganizationWorkUpdate,
    workRelations: parseWorkRelationUpdate,
  }
  const dirty = () =>
    !dequal(refs(), initial) ||
    role() !== initialRole ||
    note() !== (old?.note ?? '') ||
    spoiler() !== (old && 'isSpoiler' in old ? old.isSpoiler : false)
  const form = createForm({
    onSubmit: async () => {
      const next = nextBinding()
      const values = parseCreate[family]({
        ...next,
        note: note().trim() ? note() : null,
        ...(family !== 'workRelations' && { isSpoiler: spoiler() }),
      })
      if (!old) {
        await api.call('library.relations.create', family, values)
      } else {
        const { id, note: beforeNote, ...others } = old
        const binding = Object.fromEntries(
          Object.entries(others).filter(([key]) => key !== 'isSpoiler'),
        )
        const changes = Object.fromEntries(
          Object.entries(values).filter(([key, value]) => !dequal(value, Reflect.get(old, key))),
        )
        const expected = {
          binding,
          ...('note' in changes && { note: beforeNote }),
          ...('isSpoiler' in changes && 'isSpoiler' in old && { isSpoiler: old.isSpoiler }),
        }
        if (recasting() && refs().work && refs().character) {
          await api.call(
            'library.writeGraph',
            {
              relations: {
                workCharacters: {
                  update: [{ id, ...parseWorkCharacterUpdate({ changes, expected }) }],
                },
                personWorks: creditChanges(credits(), refs().work!, refs().character!),
              },
            },
            [],
          )
        } else {
          await api.call(
            'library.relations.update',
            family,
            id,
            parseUpdate[family]({ changes, expected }),
          )
        }
      }
      props.saved()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('library.detail.related')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <Show
              when={family === 'workRelations'}
              fallback={endpoint('work', t('library.detail.works'), workTypes)}
            >
              {endpoint('from', t('library.relation.from'), workTypes)}
              {endpoint('to', t('library.relation.to'), workTypes)}
            </Show>
            <Show when={family === 'workCharacters' || family === 'personWorks'}>
              {endpoint(
                'character',
                t('library.types.character'),
                ['character'],
                family === 'personWorks',
              )}
            </Show>
            <Show when={family === 'personWorks'}>
              {endpoint('person', t('library.types.person'), ['person'])}
            </Show>
            <Show when={family === 'organizationWorks'}>
              {endpoint('organization', t('library.types.organization'), ['organization'])}
            </Show>
            <Field>
              <FieldLabel>{t('library.relation.role')}</FieldLabel>
              <Select
                {...options}
                value={role() ?? 'unknown'}
                options={roles().map((value) => ({ value, label: t(`library.roles.${value}`) }))}
                onValueChange={(value) => {
                  if (value) {
                    setRole(value === 'unknown' ? null : value)
                  }
                }}
              />
            </Field>
            <Field>
              <FieldLabel>{t('library.fields.note')}</FieldLabel>
              <Textarea value={note()} onValueChange={setNote} />
            </Field>
            <Show when={family !== 'workRelations'}>
              <Field class="flex-row">
                <FieldLabel>{t('library.relation.spoiler')}</FieldLabel>
                <Switch checked={spoiler()} onCheckedChange={setSpoiler} />
              </Field>
            </Show>
            <Show when={recasting()}>
              {(original) => (
                <CreditDecisions
                  api={api}
                  original={original()}
                  spoilers={edit.spoilers ?? false}
                  selected={credits()}
                  change={setCredits}
                />
              )}
            </Show>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
      <Show when={picker()}>
        {(pick) => (
          <EntryPicker
            api={api}
            title={t('library.browse.pick')}
            types={pick().types}
            close={() => setPicker(undefined)}
            choose={([ref]) => {
              if (ref) {
                setRefs((before) => ({ ...before, [pick().key]: ref }))
              }
            }}
          />
        )}
      </Show>
    </>
  )
}
