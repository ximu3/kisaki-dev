import { setup, runCfiCases, textTargets, assert, rejects, byId } from './cases.mjs'
import { project } from './projection.mjs'
import { comparePoints } from './grammar.mjs'

export async function runCfiBrowser(factory, catalog) {
  const result = await runCfiCases(factory, catalog)
  const book = await setup(factory, catalog, 1)
  const targets = textTargets(book)
  let checkedEndpoints = 0
  let checkedRanges = 0
  let checkedBiases = 0
  for (const width of [1, 3, 11]) {
    const contexts = [...new Set(targets.map((target) => target.context))]
    for (const context of contexts) {
      const view = project(context, width)
      const points = targets.filter((target) => target.context === context)
      for (const target of points) {
        const saved = book.generate(target)
        const native = view.point(book.resolve(saved))
        const captured = book.generate(view.capture(native))
        assert(comparePoints(saved, captured) === 0, 'Native node splitting changed a CFI.')
        checkedEndpoints++
        if (
          target.offset > 0 &&
          target.offset < target.node.text.length &&
          target.offset % width === 0
        ) {
          const before = view.point({ ...target, bias: 'b' })
          const after = view.point({ ...target, bias: 'a' })
          assert(
            before.node !== after.node &&
              before.offset === before.node.length &&
              after.offset === 0,
            'Side bias was lost at a split boundary.'
          )
          assert(
            comparePoints(
              book.generate(view.capture(before)),
              book.generate(view.capture(after))
            ) === 0,
            'Side bias changed source ordering.'
          )
          checkedBiases++
        }
      }
      for (let index = 0; index < points.length - 1; index++) {
        const start = points[index],
          end = points[index + 1]
        if (start.node !== end.node) continue
        const one = view.point(start),
          two = view.point(end)
        const range = view.owner.createRange()
        range.setStart(one.node, one.offset)
        range.setEnd(two.node, two.offset)
        assert(
          range.toString() === start.node.text.slice(start.offset, end.offset),
          'A native Range changed an XML character.'
        )
        checkedRanges++
      }
      rejects(() => view.capture({ node: view.decoration, offset: 1 }), 'notRenderable')
    }
  }
  const context = book.contextForOccurrence(0)
  const view = project(context, 3)
  const frameContext = book.contextForEmbedding(context, byId(context, 'frame'))
  const embedContext = book.contextForEmbedding(context, byId(context, 'embed'))
  const frameView = project(frameContext, 3)
  const embeddedText = textTargets(book).find(
    (target) =>
      target.context.document.name === embedContext.document.name && target.node.kind === 'text'
  )
  rejects(() => frameView.point({ ...embeddedText, context: embedContext }), 'wrongContext')
  const address = (id, suffix) =>
    book.generate({ context, node: byId(context, id) }).slice(0, -1) + suffix + ')'
  for (const value of [address('art', ':0'), address('video', '~0')])
    rejects(() => view.point(book.resolve(value)), 'notRenderable')
  for (const suffix of ['/0', '/4', '/3:0[A,B]']) {
    const target = book.resolve(address('adjacent', suffix))
    const point = view.point(target)
    const range = view.owner.createRange()
    range.setStart(point.node, point.offset)
    range.collapse(true)
    assert(range.collapsed, 'A virtual source position did not map to a native boundary.')
  }
  return {
    ...result,
    checkedEndpoints,
    checkedRanges,
    checkedBiases,
    splitWidths: [1, 3, 11],
    nativeDomRange: true,
    sourceAltAndMediaKept: true,
    unsupportedProjectionRejected: true,
    decorationsHaveNoSourceAddress: true,
    visualLayoutChecked: false
  }
}
