import type { CallOptions, Registration } from '../operations'
import type { ExtensionUiIcon } from './icons'
import type {
  ExtensionViewDefinition,
  HostView,
  ViewMethods,
  ViewNotifications,
  ViewMethodsConstraint,
} from './views'
import { fromParser, parseValue, id, parseExternalValue } from '../validation'
import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'

export type PageRef =
  | { readonly type: 'native'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly pageId: string }

export interface ExtensionPageDefinition<
  M extends ViewMethodsConstraint<M> = ViewMethods,
  N extends object = ViewNotifications,
> extends ExtensionViewDefinition<M, N> {
  readonly id: string
  readonly icon: ExtensionUiIcon
}

export interface ExtensionPagesApi {
  register<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: ExtensionPageDefinition<M, N>,
    call?: CallOptions,
  ): Promise<Registration<PageRef & { readonly type: 'extension' }>>

  open<M extends ViewMethodsConstraint<M> = ViewMethods, N extends object = ViewNotifications>(
    input: { readonly pageId: string },
    call?: CallOptions,
  ): Promise<HostView<M, N>>
}

export function parsePageRef(input: unknown): PageRef {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('native'), id }),
      v.strictObject({
        type: v.literal('extension'),
        extensionId: fromParser((value) =>
          parseExternalValue(parseId, value, 'Invalid extension identity'),
        ),
        pageId: id,
      }),
    ]),
    input,
    'Invalid page reference',
  )
}
