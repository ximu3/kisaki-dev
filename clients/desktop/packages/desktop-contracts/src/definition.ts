/** @fileoverview Reads stored executable definitions without turning malformed data into a usable default. */

import { ExecutionError, type ErrorSummary } from './errors'

/** Invalid stored definitions are visible but not executable or editable through a raw-text repair contract. */
export type DefinitionRead<Value> =
  | { readonly status: 'valid'; readonly value: Value }
  | { readonly status: 'invalid'; readonly error: ErrorSummary }

/** Decode and validate one stored JSON definition, leaving its original storage and other fields untouched. */
export function readDefinition<Value>(
  stored: string,
  parseValue: (input: unknown) => Value,
): DefinitionRead<Value> {
  try {
    const input: unknown = JSON.parse(stored)
    return { status: 'valid', value: parseValue(input) }
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof ExecutionError && error.code === 'InvalidInput')
    ) {
      return {
        status: 'invalid',
        error: {
          code: 'DataIntegrityError',
          message: 'The stored configuration definition is invalid.',
        },
      }
    }
    throw error
  }
}
