import * as v from 'valibot'
import { unique } from '../validation'

export function distinctMembers<S extends v.GenericSchema>(
  schema: S,
  key: (value: v.InferOutput<S>) => string,
) {
  return v.pipe(
    v.array(schema),
    v.check((items) => unique(items, key)),
  )
}

export function membershipChangeSchema<M extends v.GenericSchema, R extends v.GenericSchema>(
  member: M,
  reference: R,
  referenceOf: (member: v.InferOutput<M>) => v.InferOutput<R>,
  keyOf: (ref: v.InferOutput<R>) => string,
) {
  const members = distinctMembers(member, (item) => keyOf(referenceOf(item)))
  return v.variant('type', [
    v.strictObject({ type: v.literal('replace'), items: members }),
    v.pipe(
      v.strictObject({
        type: v.literal('modify'),
        add: v.exactOptional(members),
        remove: v.exactOptional(distinctMembers(reference, keyOf)),
      }),
      v.check(({ add = [], remove = [] }) => {
        if (add.length === 0 && remove.length === 0) {
          return false
        }
        const removed = new Set(remove.map(keyOf))
        return add.every((item) => !removed.has(keyOf(referenceOf(item))))
      }),
    ),
  ])
}
