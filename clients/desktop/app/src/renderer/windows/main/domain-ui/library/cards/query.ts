import type { ShowcaseQuery, EntryRef } from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { MainClient } from '../../../../../infrastructure/api'
export type CardTarget = EntryRef | { type: 'collection'; id: string } | { type: 'tag'; id: string }
export interface CardItem {
  target: CardTarget
  name: string
  image: string | null
}
export interface CardAnchor {
  target: CardTarget
  across: number
  down: number
}
export function readCards(
  api: MainClient,
  query: ShowcaseQuery,
  range: ListOptions,
  signal: AbortSignal,
): Promise<ListResult<CardItem>> {
  switch (query.kind) {
    case 'entry': {
      const { scope, rules, search, sort } = query
      const input = { scope, rules, search, sort }
      return api
        .request(signal, 'library.entries.list', input, { ...range, fields: ['primaryImageId'] })
        .then((page) => ({
          total: page.total,
          items: page.items.map((item) => ({
            target: { type: item.type, id: item.id },
            name: item.name,
            image: item.primaryImageId ?? null,
          })),
        }))
    }
    case 'collection': {
      const { kind, ...input } = query
      return api.request(signal, 'library.collections.list', input, range).then((page) => ({
        total: page.total,
        items: page.items.map((item) => ({
          target: { type: kind, id: item.id },
          name: item.name,
          image: item.primaryImageId,
        })),
      }))
    }
    case 'tag': {
      const { kind, ...input } = query
      return api.request(signal, 'library.tags.list', input, range).then((page) => ({
        total: page.total,
        items: page.items.map((item) => ({
          target: { type: kind, id: item.id },
          name: item.name,
          image: null,
        })),
      }))
    }
  }
}

export async function locateCard(
  api: MainClient,
  query: ShowcaseQuery,
  target: CardTarget,
  signal: AbortSignal,
) {
  if (query.kind === 'entry') {
    if (target.type === 'collection' || target.type === 'tag') {
      return null
    }
    const { scope, sort, rules, search } = query
    return (
      (
        await api.request(
          signal,
          'library.entries.locate',
          { scope, sort, rules, search },
          { type: target.type, id: target.id },
          { limit: 1 },
        )
      )?.index ?? null
    )
  }
  if (target.type !== query.kind) {
    return null
  }
  for (let offset = 0; ; offset += 200) {
    const page = await readCards(api, query, { offset, limit: 200 }, signal)
    const at = page.items.findIndex((item) => item.target.id === target.id)
    if (at >= 0) {
      return offset + at
    }
    if (offset + page.items.length >= page.total) {
      return null
    }
  }
}
