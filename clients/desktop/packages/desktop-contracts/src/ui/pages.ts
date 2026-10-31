/** @fileoverview Owns stable page references shared by navigation, preferences, and view contributions. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { nonemptyStringSchema, parseContract } from '../validation'

/** A saved page choice. The host verifies native catalog keys and actual extension page registrations. */
export type PageRef =
  | { readonly type: 'native'; readonly id: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly pageId: string }

export const pageRefSchema: v.GenericSchema<unknown, PageRef> = v.union([
  objectSchema({ type: v.literal('native'), id: nonemptyStringSchema }),
  objectSchema({
    type: v.literal('extension'),
    extensionId: nonemptyStringSchema,
    pageId: nonemptyStringSchema,
  }),
])

/** Parse an exact page identity without interpreting titles or arbitrary URLs as routes. */
export function parsePageRef(input: unknown): PageRef {
  return parseContract(pageRefSchema, input, 'page reference')
}
