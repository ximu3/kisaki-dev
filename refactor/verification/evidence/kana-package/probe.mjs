// Exercise two independently configured archives without a mock Reader implementation.
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function openArchive(label) {
  const bytes = new Uint8Array(await (await fetch(`/${label}.zip`)).arrayBuffer())
  const size = bytes.length
  const worker = new Worker(`/${label}/archive-worker.mjs`, { type: 'module' })
  const reads = []
  let result
  worker.onmessage = ({ data }) => {
    if (data.type === 'read') {
      assert(
        data.offset >= 0 && data.length >= 0 && data.offset + data.length <= size,
        'Invalid source range.'
      )
      reads.push([data.offset, data.length])
      const chunk = bytes.slice(data.offset, data.offset + data.length)
      worker.postMessage({ type: 'bytes', id: data.id, bytes: chunk }, [chunk.buffer])
    } else if (data.type === 'failed') {
      result.reject(new Error(data.message))
    } else result.resolve(data)
  }
  worker.onerror = (event) => result.reject(new Error(event.message))
  const call = (type) =>
    new Promise((resolve, reject) => {
      result = { resolve, reject }
      worker.postMessage({ type, size })
    })
  const opened = await call('open')
  assert(opened.names.join() === 'chapter.txt', 'Unexpected member identity.')
  return { label, worker, call, reads, sourceKept: () => bytes.length === size }
}

export async function run() {
  const archives = []
  try {
    for (const label of ['a', 'b']) archives.push(await openArchive(label))
    const [a, b] = archives
    const first = await Promise.all(archives.map((archive) => archive.call('extract')))
    for (let index = 0; index < archives.length; index++) {
      assert(
        first[index].text === `Archive ${archives[index].label}: 甲乙\r\n`,
        'Wrong decoded source.'
      )
    }
    const closedA = await a.call('close')
    const secondB = await b.call('extract')
    assert(secondB.text === first[1].text, 'Closing one archive disturbed the other.')
    const closedB = await b.call('close')
    assert(
      closedA.pendingReads === 0 && closedB.pendingReads === 0,
      'Source reads remained active.'
    )
    assert(
      archives.every((archive) => archive.sourceKept()),
      'Borrowed source was detached.'
    )
    return {
      independentAssets: true,
      otherArchiveSurvivedClose: true,
      borrowedSourcesKept: true,
      reads: archives.map(({ label, reads }) => ({ label, reads })),
      completeReaderExecuted: false,
      fullPackageExecuted: false
    }
  } finally {
    for (const archive of archives) archive.worker.terminate()
  }
}
