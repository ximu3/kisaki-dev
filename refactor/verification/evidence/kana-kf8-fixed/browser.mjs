// A fixed-page geometry fixture; resource delivery uses only the harness's finite routes.
import * as parse5 from '/deps/parse5.mjs'
import { createMarkupMapper } from '/mapping/markup.mjs'

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const near = (actual, expected) => Math.abs(actual - expected) < 0.2
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value
const walk = (node, output = []) => {
  output.push(node)
  node.childNodes?.forEach((child) => walk(child, output))
  return output
}
async function display(source, run, width, replaceRoot = false) {
  const iframe = document.createElement('iframe')
  iframe.width = run.viewport.width
  iframe.height = run.viewport.height
  iframe.style.cssText = 'display:block;border:0;transform-origin:top left;'
  const ready = new Promise((resolve) => {
    iframe.onload = resolve
  })
  iframe.src = 'about:blank'
  document.body.append(iframe)
  await ready
  const owner = iframe.contentDocument
  const nodes = new Map(),
    texts = new Map(),
    reverse = new WeakMap(),
    styleLoads = []
  function create(sourceNode, insideBody = false) {
    if (sourceNode.nodeName === '#text') {
      const group = owner.createDocumentFragment(),
        segments = []
      const step = insideBody ? width : Math.max(sourceNode.value.length, 1)
      for (let start = 0; start < sourceNode.value.length; start += step) {
        const text = owner.createTextNode(sourceNode.value.slice(start, start + step))
        group.append(text)
        segments.push({ node: text, start, end: start + text.length })
        reverse.set(text, { source: sourceNode, start })
      }
      texts.set(sourceNode, segments)
      return group
    }
    if (!sourceNode.tagName) return null
    const node = owner.createElementNS(sourceNode.namespaceURI, sourceNode.tagName)
    nodes.set(sourceNode, node)
    for (const attribute of sourceNode.attrs) {
      if (['src', 'href'].includes(attribute.name)) continue
      node.setAttribute(attribute.name, attribute.value)
    }
    if (sourceNode.tagName === 'img') {
      assert(
        attr(sourceNode, 'src') === 'kindle:embed:0001?mime=image/jpeg',
        'Unexpected fixture image.'
      )
      node.src = '/assets/' + run.name + '.jpg'
    } else if (sourceNode.tagName === 'link') {
      assert(
        attr(sourceNode, 'href') === 'kindle:flow:0001?mime=text/css',
        'Unexpected fixture stylesheet.'
      )
      styleLoads.push(
        new Promise((resolve, reject) => {
          node.onload = resolve
          node.onerror = () => reject(new Error('The fixture stylesheet failed.'))
        })
      )
      node.href = '/assets/' + run.name + '.css'
    }
    for (const child of sourceNode.childNodes) {
      const content = create(child, insideBody || sourceNode.tagName === 'body')
      if (content) node.append(content)
    }
    return node
  }
  try {
    const root = source.tree.childNodes.find((node) => node.tagName === 'html')
    const constructed = create(root)
    if (replaceRoot) owner.replaceChild(constructed, owner.documentElement)
    else {
      const nativeRoot = owner.documentElement
      for (const attribute of [...nativeRoot.attributes]) nativeRoot.removeAttributeNode(attribute)
      for (const attribute of [...constructed.attributes])
        nativeRoot.setAttribute(attribute.name, attribute.value)
      nativeRoot.replaceChildren(...constructed.childNodes)
      nodes.set(root, nativeRoot)
    }
    await Promise.all(styleLoads)
    await Promise.all([...owner.images].map((image) => image.decode()))
    await new Promise((resolve) => iframe.contentWindow.requestAnimationFrame(resolve))
    return {
      iframe,
      owner,
      nodes,
      texts,
      reverse,
      point(sourcePoint, end = false) {
        const segments = texts.get(sourcePoint.node)
        const selected =
          segments.find(
            (segment) =>
              sourcePoint.offset >= segment.start &&
              (end ? sourcePoint.offset <= segment.end : sourcePoint.offset < segment.end)
          ) ?? segments.at(-1)
        return { node: selected.node, offset: sourcePoint.offset - selected.start }
      }
    }
  } catch (error) {
    iframe.remove()
    throw error
  }
}
export async function runFixedBrowser() {
  const [report, maps] = await Promise.all([
    fetch('/fixed/node-contract.json').then((response) => response.json()),
    fetch('/deps/maps.json').then((response) => response.json())
  ])
  const parse = createMarkupMapper(parse5, maps)
  const initialRun = report.runs[0]
  const initialBytes = new Uint8Array(
    await (await fetch('/decoded/' + initialRun.documents[0].filename)).arrayBuffer()
  )
  const comparison = await display(parse(initialBytes, 'utf-8', 1), initialRun, 1, true)
  let rootReplacement
  try {
    const bodyBox = comparison.owner.body.getBoundingClientRect()
    const rootBox = comparison.owner.documentElement.getBoundingClientRect()
    const frameBox = comparison.iframe.getBoundingClientRect()
    const computed = comparison.iframe.contentWindow.getComputedStyle(comparison.owner.body)
    rootReplacement = {
      bodyBox: [bodyBox.width, bodyBox.height],
      rootBox: [rootBox.width, rootBox.height],
      frameBox: [frameBox.width, frameBox.height],
      computedBody: [computed.width, computed.height],
      oneAnimationFrameAwaited: true
    }
  } finally {
    comparison.iframe.remove()
  }
  const cases = []
  let checkedTextRanges = 0,
    imageRestores = 0,
    textRestores = 0
  for (const run of report.runs.filter((item) => !item.viewport.failure)) {
    for (const record of run.documents) {
      const bytes = new Uint8Array(await (await fetch('/decoded/' + record.filename)).arrayBuffer())
      for (const width of [1, 7]) {
        const source = parse(bytes, 'utf-8', width)
        const view = await display(source, run, width)
        try {
          const body = walk(source.tree).find((node) => node.tagName === 'body')
          const bodyNodes = new Set(walk(body))
          const bodyBox = view.owner.body.getBoundingClientRect()
          assert(
            near(bodyBox.width, 480) && near(bodyBox.height, 640),
            'Intrinsic page size changed: ' +
              JSON.stringify({
                name: run.name,
                documentIndex: record.documentIndex,
                width,
                box: [bodyBox.width, bodyBox.height],
                computed: [
                  view.iframe.contentWindow.getComputedStyle(view.owner.body).width,
                  view.iframe.contentWindow.getComputedStyle(view.owner.body).height
                ],
                stylesheets: view.owner.styleSheets.length,
                rootBox: [
                  view.owner.documentElement.getBoundingClientRect().width,
                  view.owner.documentElement.getBoundingClientRect().height
                ],
                frameBox: [
                  view.iframe.getBoundingClientRect().width,
                  view.iframe.getBoundingClientRect().height
                ],
                display: [
                  view.iframe.contentWindow.getComputedStyle(view.owner.body).display,
                  view.iframe.contentWindow.getComputedStyle(view.owner.documentElement).display
                ],
                connection: [view.owner.body.isConnected, view.iframe.isConnected],
                ready: view.owner.readyState
              })
          )
          for (const unit of source.units) {
            if (!unit.value.length) continue
            for (const item of unit.projections) {
              if (!bodyNodes.has(item.node)) continue
              const start = view.point(item)
              const end = view.point(
                { node: item.node, offset: item.offset + unit.value.length },
                true
              )
              const range = view.owner.createRange()
              range.setStart(start.node, start.offset)
              range.setEnd(end.node, end.offset)
              assert(range.toString() === unit.value, 'Fixed-page text projection changed.')
              const binding = view.reverse.get(start.node)
              const saved = source.fromText(binding.source, binding.start + start.offset)
              const restored = source.resolve(saved.byteOffset, saved.textOffset)
              assert(
                restored.projections.some(
                  (other) => other.node === item.node && other.offset === item.offset
                ),
                'A split fixed-page text address changed.'
              )
              checkedTextRanges++
            }
          }
          for (const scale of [0.5, 1.25]) {
            view.iframe.style.transform = `scale(${scale})`
            const box = view.iframe.getBoundingClientRect()
            assert(
              near(box.width, 480 * scale) && near(box.height, 640 * scale),
              'Fixed-page scaling changed.'
            )
            for (const image of record.images) {
              const original = source.resolve(image.address.byteOffset).nodes[0]
              const node = view.nodes.get(original)
              const rectangle = node.getBoundingClientRect()
              assert(
                node.naturalWidth === 240 && node.naturalHeight === 320,
                'Image bytes changed.'
              )
              assert(
                near(rectangle.width, image.width) && near(rectangle.height, image.height),
                'Original image geometry changed.'
              )
              const expectedLeft = image.id === 'art' ? 20 : 0
              const expectedTop = image.id === 'art' ? 80 : 0
              assert(
                near(rectangle.left, expectedLeft) && near(rectangle.top, expectedTop),
                'The authored image position changed.'
              )
              const screenPoint = {
                x: box.left + (rectangle.left + rectangle.width / 2) * scale,
                y: box.top + (rectangle.top + rectangle.height / 2) * scale
              }
              const hit = view.owner.elementFromPoint(
                (screenPoint.x - box.left) / scale,
                (screenPoint.y - box.top) / scale
              )
              assert(hit === node, 'The scaled image point did not restore its source element.')
              imageRestores++
            }
            for (const anchor of record.anchors) {
              const restored = source.resolve(anchor.byteOffset, anchor.textOffset)
              const native = view.point(restored.projections[0])
              const binding = view.reverse.get(native.node)
              const saved = source.fromText(binding.source, binding.start + native.offset)
              const again = source.resolve(saved.byteOffset, saved.textOffset)
              assert(
                again.ordinal === restored.ordinal,
                'Scaling changed a fixed-page source offset.'
              )
              textRestores++
            }
          }
          cases.push({
            name: run.name,
            documentIndex: record.documentIndex,
            direction: run.direction,
            width,
            scales: [0.5, 1.25],
            intrinsic: [480, 640],
            images: record.images.length,
            hasNonWhitespaceSourceText: record.hasNonWhitespaceSourceText
          })
        } finally {
          view.iframe.remove()
        }
      }
    }
  }
  assert(!document.querySelector('iframe'), 'A page fixture remained mounted.')
  return {
    rootReplacement,
    cases,
    checkedTextRanges,
    imageRestores,
    textRestores,
    allFramesRemoved: true,
    fullReader: false,
    resourceBackend: 'finite-harness-http-routes',
    productionServiceWorkerExercised: false,
    rtlSpreadLayout: false,
    kindleDeviceCompatibility: false
  }
}
