// Compare pagination boundaries and author context through documented component entry points.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const nextPaint = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

function fixture(kind, mode) {
  const ids = kind === 'natural' ? ['a', 'b', 'c', 'd', 'e', 'f'] : ['a', 'b', 'c']
  const breaks = (id) =>
    kind === 'natural' || id === 'a'
      ? ''
      : ' data-break-before="page" style="break-before:page;margin-block-start:20px"'
  let content
  if (kind === 'table') {
    const texts = [
      ['A', 'short'],
      ['BMMMMMMMMMMMM', 'X'],
      ['C', 'yyyyyy']
    ]
    content = `<table class="book" id="book"><tbody>${ids
      .map(
        (id, index) =>
          `<tr class="unit" id="${id}" data-marker="${id}"${breaks(id)}><td>${texts[index][0]}</td><td>${texts[index][1]}</td></tr>`
      )
      .join('')}</tbody></table>`
  } else {
    const parent = kind === 'list' ? 'ol' : 'section'
    const child = kind === 'list' ? 'li' : 'p'
    content = `<${parent} class="book" id="book">${ids
      .map(
        (id) =>
          `<${child} class="unit" id="${id}" data-marker="${id}"${breaks(id)}><span data-ink="${id}">${id.toUpperCase()}</span></${child}>`
      )
      .join('')}</${parent}>`
  }
  const css = `
    html,body{margin:0;padding:0;writing-mode:${mode};font:20px/1 monospace}
    *{box-sizing:border-box}
    .book{margin:0;padding:0;writing-mode:${mode};counter-reset:probe 8}
    .unit{block-size:${kind === 'natural' ? 100 : 60}px;margin:0;padding:0;break-inside:avoid}
    ol{list-style-position:inside}
    .book>.unit:nth-child(2),.book>tbody>.unit:nth-child(2){color:rgb(204,0,17);font-weight:700}
    .book>.unit+.unit{border-inline-start:2px solid rgb(0,70,140)}
    section>.unit{counter-increment:probe}
    section>.unit::before{content:counter(probe) ":"}
    table{border-collapse:collapse;border-spacing:0;inline-size:100%}
    td{padding:0}
  `
  return { kind, mode, content, css, ids }
}

function inspect(container, mode) {
  const doc = container.ownerDocument
  const hostBounds = container.getBoundingClientRect()
  return [...container.querySelectorAll('[data-marker]')].map((element) => {
    const rect = element.getBoundingClientRect()
    const style = doc.defaultView.getComputedStyle(element)
    const range = doc.createRange()
    const ink = element.querySelector('[data-ink]')
    if (ink) range.selectNodeContents(ink)
    const textRect = ink ? range.getBoundingClientRect() : null
    return {
      id: element.getAttribute('data-marker'),
      text: element.textContent,
      color: style.color,
      fontWeight: style.fontWeight,
      writingMode: style.writingMode,
      marginBlockStart: style.marginBlockStart,
      borderInlineStartWidth: style.borderInlineStartWidth,
      relative: {
        x: rect.x - hostBounds.x,
        y: rect.y - hostBounds.y,
        width: rect.width,
        height: rect.height
      },
      textInset: textRect
        ? mode === 'horizontal-tb'
          ? textRect.x - rect.x
          : textRect.y - rect.y
        : null,
      cells: [...element.querySelectorAll('td')].map((cell) => {
        const box = cell.getBoundingClientRect()
        return { width: box.width, height: box.height }
      })
    }
  })
}

async function reference(input) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'width:280px;height:400px;border:0;position:absolute;left:-10000px;top:0'
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><style>${input.css}</style>${input.content}`
  document.body.append(frame)
  await loaded
  const result = inspect(frame.contentDocument.body, input.mode)
  frame.remove()
  return result
}

function compare(input, baseline, pages) {
  const output = pages.flatMap((page) => page.markers)
  const ids = output.map((item) => item.id)
  const sourceOrderPreserved = JSON.stringify(ids) === JSON.stringify(input.ids)
  const forceGroupsMatch =
    input.kind === 'natural'
      ? null
      : pages.length === input.ids.length &&
        pages.every(
          (page, index) => page.markers.length === 1 && page.markers[0].id === input.ids[index]
        )
  const stylesMatch = output.every((item) => {
    const expected = baseline.find((source) => source.id === item.id)
    return (
      expected &&
      item.color === expected.color &&
      item.fontWeight === expected.fontWeight &&
      item.borderInlineStartWidth === expected.borderInlineStartWidth
    )
  })
  const inlineMetricsMatch = output.every((item) => {
    const expected = baseline.find((source) => source.id === item.id)
    if (!expected) return false
    if (item.textInset !== null && expected.textInset !== null)
      return Math.abs(item.textInset - expected.textInset) < 0.5
    if (item.cells.length)
      return item.cells.every((cell, index) => {
        const property = input.mode === 'horizontal-tb' ? 'width' : 'height'
        return Math.abs(cell[property] - expected.cells[index][property]) < 1.1
      })
    return true
  })
  const contentFitsPages = pages.every((page) =>
    page.markers.every(({ relative: rect }) =>
      [rect.x, rect.y, 280 - rect.x - rect.width, 400 - rect.y - rect.height].every(
        (distance) => distance > -1.1
      )
    )
  )
  const tableColumnsConsistent =
    input.kind === 'table' && output.length
      ? output.every((item) =>
          item.cells.every((cell, index) => {
            const property = input.mode === 'horizontal-tb' ? 'width' : 'height'
            return Math.abs(cell[property] - output[0].cells[index][property]) < 0.2
          })
        )
      : null
  const logicalStartAndSizeMatch =
    input.kind === 'table' || input.kind === 'natural'
      ? null
      : output.every((item) => {
          const start = item.id === 'a' ? 0 : 20
          const expected =
            input.mode === 'horizontal-tb'
              ? { x: 0, y: start, width: 280, height: 60 }
              : input.mode === 'vertical-rl'
                ? { x: 220 - start, y: 0, width: 60, height: 400 }
                : { x: start, y: 0, width: 60, height: 400 }
          return Object.entries(expected).every(
            ([key, value]) => Math.abs(item.relative[key] - value) < 0.5
          )
        })
  return {
    sourceOrderPreserved,
    forceGroupsMatch,
    stylesMatch,
    inlineMetricsMatch,
    tableColumnsConsistent,
    logicalStartAndSizeMatch,
    contentFitsPages
  }
}

async function pagedLayout(input) {
  const { Layout, ContentParser } = await import('/paged-layout/src/index.js')
  const sheet = document.createElement('style')
  sheet.textContent =
    input.css +
    'html,body{writing-mode:horizontal-tb}.page{width:280px;height:400px;overflow:hidden;position:relative;margin-bottom:8px}'
  document.head.append(sheet)
  const template = document.createElement('template')
  template.innerHTML = input.content
  const original = template.content.cloneNode(true)
  const before = template.innerHTML
  const source = new ContentParser(template.content)
  const annotated = template.innerHTML !== before
  const pages = []
  const errors = []
  let token, previous
  let ended = false
  for (let index = 0; index < 12; index++) {
    const page = document.createElement('div')
    page.className = 'page'
    page.style.writingMode = input.mode
    const wrapper = document.createElement('div')
    page.append(wrapper)
    document.body.append(page)
    const layout = new Layout(page)
    const result = await layout.renderTo(wrapper, source, token, previous)
    if (result.error) errors.push(String(result.error))
    pages.push({ page: index, markers: inspect(page, input.mode), text: wrapper.textContent })
    token = result.breakToken
    previous = wrapper
    if (!token) {
      ended = true
      break
    }
  }
  return {
    pages,
    ended,
    errors,
    sourceAnnotated: annotated,
    originalText: original.textContent,
    sourceTextAfter: source.textContent,
    sourceContainerChildrenAfter: source.childNodes.length,
    formatSourceMappingImplemented: false,
    cssBreakResolutionExecuted: false
  }
}

async function vivliostyle(input, diagnostic) {
  const script = document.createElement('script')
  script.src = diagnostic ? '/viv-diagnostic.js' : '/viv.js'
  document.head.append(script)
  await new Promise((resolve, reject) => {
    script.onload = resolve
    script.onerror = () => reject(new Error('The fixed comparison bundle did not load.'))
  })
  const viewport = document.createElement('div')
  viewport.style.cssText = 'width:280px;height:400px;position:relative'
  document.body.append(viewport)
  const source = new DOMParser().parseFromString(
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>@page{size:280px 400px;margin:0}${input.css}</style></head><body>${input.content}</body></html>`,
    'application/xhtml+xml'
  )
  const before = source.documentElement.outerHTML
  const viewer = new Viv.CoreViewer(
    { viewportElement: viewport },
    {
      autoResize: false,
      renderAllPages: true,
      allowScripts: false,
      pageViewMode: Viv.PageViewMode.SINGLE_PAGE,
      defaultPaperSize: { width: 280, height: 400 },
      pixelRatio: 1
    }
  )
  const completed = []
  viewer.addListener('done', (event) => completed.push(event.a))
  viewer.loadDocument({ url: location.origin + '/controlled.xhtml' }, { documentObject: source })
  const deadline = performance.now() + 8000
  while (
    (viewer.readyState !== Viv.ReadyState.COMPLETE || !completed.includes('loadXML')) &&
    performance.now() < deadline
  )
    await pause(25)
  if (viewer.readyState !== Viv.ReadyState.COMPLETE || !completed.includes('loadXML'))
    throw new Error('The comparison did not complete within its layout deadline.')
  const count = viewer.getPageSizes().length
  const pages = []
  for (let index = 0; index < Math.min(count, 12); index++) {
    const previousMoves = completed.filter((action) => action === 'moveTo').length
    viewer.navigateToPosition({ spineIndex: 0, pageIndex: index })
    const containers = [...viewport.querySelectorAll('[data-vivliostyle-page-container]')]
    const page = containers[index]
    const navigationDeadline = performance.now() + 3000
    while (
      (completed.filter((action) => action === 'moveTo').length === previousMoves ||
        getComputedStyle(page).display === 'none' ||
        page.getBoundingClientRect().width === 0) &&
      performance.now() < navigationDeadline
    )
      await pause(16)
    await nextPaint()
    if (
      completed.filter((action) => action === 'moveTo').length === previousMoves ||
      getComputedStyle(page).display === 'none' ||
      page.getBoundingClientRect().width === 0
    )
      throw new Error('The requested comparison page did not become visible.')
    pages.push({
      page: index,
      markers: inspect(page, input.mode),
      text: page.textContent,
      display: getComputedStyle(page).display,
      visibility: getComputedStyle(page).visibility
    })
  }
  return {
    pages,
    ended: count <= 12,
    sourceAnnotated: source.documentElement.outerHTML !== before,
    sourceTextAfter: source.querySelector('body').textContent,
    diagnosticVerticalClassificationChange: diagnostic,
    formatSourceMappingImplemented: false,
    cssBreakResolutionExecuted: true
  }
}

window.paginationReview = async (backend, kind, mode) => {
  const input = fixture(kind, mode)
  const baseline = await reference(input)
  const result =
    backend === 'paged-layout'
      ? await pagedLayout(input)
      : await vivliostyle(input, backend === 'vivliostyle-diagnostic')
  return {
    backend,
    kind,
    mode,
    baseline,
    ...result,
    comparison: compare(input, baseline, result.pages)
  }
}
