import { join } from 'node:path'
import { expect, test } from 'vite-plus/test'
import { inspectVideo } from '../../../../src/main/infrastructure/media/inspect'
import { appRoot } from '../../../../tools/lib/paths'
import { hostTarget } from '../../../../tools/lib/targets'

test('the packaged libmpv runtime reads tracks and chapter positions without opening a player window', async () => {
  const resourceRoot = join(appRoot, 'out', 'resources', hostTarget())
  const data = await inspectVideo(
    resourceRoot,
    join(appRoot, 'tests', 'fixtures', 'media', 'two-chapters.mkv'),
    new AbortController().signal,
  )
  expect(data.metadata).toMatchObject({ width: 160, height: 90, durationSeconds: 1 })
  expect(data.tracks.map((track) => track.type)).toEqual(['video', 'audio'])
  expect(data.chapters.map((chapter) => chapter.time)).toEqual([0, 0.5])
})
