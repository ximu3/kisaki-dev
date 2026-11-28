import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import { parseReorderInput, parseMoveInput } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { CompleteWrite } from '../transaction'
import { readScope, type relationStorage } from './storage'
import { relationTables, type RelationKind } from './facts'

export function relationKind(value: unknown): RelationKind {
  if (typeof value !== 'string' || !Object.hasOwn(relationTables, value)) {
    throw new DesktopError('InvalidInput', 'Invalid relationship family')
  }
  return value as RelationKind
}
import type { Relation } from './facts'
export function createRelations(
  call: DatabaseCall<ReturnType<typeof relationStorage>>,
  sensitive: () => boolean,
  complete: CompleteWrite,
) {
  function api<K extends RelationKind>(kind: K) {
    const listVisible = (scope: unknown, range: unknown, spoilers: boolean) =>
      call('listFacts', readScope(kind, scope), parseListOptions(range), sensitive(), spoilers)
    const getVisible = (id: string, spoilers: boolean) =>
      call('readVisibleFact', kind, id, sensitive(), spoilers)
    return {
      listVisible,
      getVisible,
      async list(scope: unknown, range: unknown) {
        const page = await listVisible(scope, range, false)
        return {
          total: page.total,
          items: page.items.map((item) => item as Extract<Relation, { kind: K }>['value']),
        }
      },
      get: (id: string) =>
        getVisible(id, false) as Promise<Extract<Relation, { kind: K }>['value'] | null>,
      async create(raw: unknown, options?: CallOptions) {
        options?.signal?.throwIfAborted()
        return complete(await call('createFact', kind, raw))
      },
      async update(id: string, raw: unknown, options?: CallOptions) {
        options?.signal?.throwIfAborted()
        complete(await call('editFact', kind, id, raw))
      },
      async delete(id: string, options?: CallOptions) {
        options?.signal?.throwIfAborted()
        complete(await call('deleteFact', kind, id))
      },
      async reorder(scope: unknown, raw: unknown, options?: CallOptions) {
        options?.signal?.throwIfAborted()
        complete(await call('arrangeFacts', readScope(kind, scope), parseReorderInput(raw)))
      },
      async move(scope: unknown, raw: unknown, options?: CallOptions) {
        options?.signal?.throwIfAborted()
        complete(await call('arrangeFacts', readScope(kind, scope), parseMoveInput(raw)))
      },
    }
  }
  return {
    workCharacters: api('workCharacter'),
    personWorks: api('personWork'),
    organizationWorks: api('organizationWork'),
    workRelations: api('workRelation'),
  }
}
