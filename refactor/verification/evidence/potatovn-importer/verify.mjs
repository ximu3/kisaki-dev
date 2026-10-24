import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

// Research checks for synthetic source-format data; this is not the product importer.
const modulePath = process.argv[2]
assert(modulePath, 'Pass the fflate 0.8.3 ESM module path.')
const { unzipSync } = await import(pathToFileURL(resolve(modulePath)).href)
const root = dirname(fileURLToPath(import.meta.url))
const archivePath = join(root, 'synthetic.pvnExport.zip')
const bytes = readFileSync(archivePath)
const hash = (value) => createHash('sha256').update(value).digest('hex')
const before = hash(bytes)
const entries = unzipSync(bytes)
const json = (name) => JSON.parse(Buffer.from(entries[name]).toString('utf8'))
const games = json('data.galgames.json')
const sources = json('data.galgameSources.json')
const groups = json('data.categoryGroups.json')
const staff = json('data.staff.json')
const status = json('data.dataStatus.json')
const tests = []
const check = (name, result) => {
  assert(result, name)
  tests.push(name)
}
const guid = (n) => '20000000-0000-0000-0000-' + String(n).padStart(12, '0')
const byId = new Map(games.map((game) => [game.Uuid, game]))
function validateUniqueGames(rows) {
  return rows.length === new Set(rows.map((game) => game.Uuid)).size
}
function sourceIdentity(slot, raw) {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  const patterns = {
    0: /^(?:v)?([1-9][0-9]*)$/,
    1: /^([1-9][0-9]*)$/,
    5: /^([1-9][0-9]*)$/,
    7: /^([1-9][0-9]*)$/
  }
  const match = patterns[slot]?.exec(value)
  if (!match) return null
  const id = BigInt(match[1]).toString()
  return { 0: 'vndb/v' + id, 1: 'bangumi/subject/' + id, 5: 'ymgal/ga' + id, 7: 'steam/app/' + id }[
    slot
  ]
}
function personalScore(game) {
  const score = game.MyRate
  if (!Number.isInteger(score) || score < 0 || score > 10) return undefined
  return score === 0 ? null : score * 10
}
const states = [
  { status: null, completed: false },
  { status: 'active', completed: false },
  { status: null, completed: true },
  { status: 'onHold', completed: false },
  { status: undefined, completed: false },
  { status: 'planned', completed: false }
]
function totalMilliseconds(game) {
  let minutes
  if (Object.hasOwn(game, 'TotalPlayTime')) {
    if (!Number.isSafeInteger(game.TotalPlayTime) || game.TotalPlayTime < 0) return undefined
    minutes = BigInt(game.TotalPlayTime)
  } else if (
    game.PlayedTime &&
    typeof game.PlayedTime === 'object' &&
    !Array.isArray(game.PlayedTime)
  ) {
    const values = Object.values(game.PlayedTime)
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) return undefined
    minutes = values.reduce((sum, value) => sum + BigInt(value), 0n)
  } else return undefined
  const milliseconds = minutes * 60000n
  return milliseconds <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(milliseconds) : undefined
}
function managedImage(reference) {
  if (typeof reference !== 'string') return null
  const path = reference.replaceAll('\\', '/')
  if (path.startsWith('/') || path.includes(':') || path.split('/').includes('..')) return null
  return path
    .split('/')
    .filter((part) => part && part !== '.')
    .join('/')
}
function sourceArguments(config, localeExecutable) {
  if (config.RunInLocaleEmulator) {
    return localeExecutable ? { executable: localeExecutable, argv: [config.ExePath] } : null
  }
  return {
    executable: config.ExePath,
    argv:
      config.ExeArguments === null || config.ExeArguments === undefined ? [] : [config.ExeArguments]
  }
}
const allEntries = sources.flatMap((source) => source.Galgames.map((entry) => ({ source, entry })))
const installations = allEntries.filter(
  ({ source }) => source.SourceType === 1 || source.SourceType === 4
)
const localTwo = installations.filter(({ entry }) => entry.Galgame === guid(2))
const customGroups = groups.filter((group) => group.Type === 2)
check(
  'plain JSON export contains six logical games',
  Array.isArray(games) && games.length === 6 && validateUniqueGames(games)
)
check('duplicate source UUIDs are detectable', !validateUniqueGames([...games, games[0]]))
check(
  'field wrapper retains value and source lock separately',
  games[0].Name.Value === 'Synthetic visual novel 1' && games[0].Name.IsLock === true
)
check(
  'four explicit public identity slots normalize',
  sourceIdentity(0, games[0].Ids[0]) === 'vndb/v1001' &&
    sourceIdentity(1, games[0].Ids[1]) === 'bangumi/subject/2001' &&
    sourceIdentity(5, games[0].Ids[5]) === 'ymgal/ga3001' &&
    sourceIdentity(7, games[4].Ids[7]) === 'steam/app/480'
)
check(
  'VNDB release is not rewritten into a work ID',
  sourceIdentity(0, games[2].Ids[0]) === null && games[2].Ids[0] === 'r123'
)
check(
  'internal and mixed-source slots are not public identities',
  sourceIdentity(2, 'vndb:123') === null &&
    sourceIdentity(4, '123') === null &&
    sourceIdentity(0, '-1') === null
)
check(
  'zero means unrated; positive personal score scales by ten',
  personalScore(games[0]) === null &&
    personalScore(games[1]) === 80 &&
    personalScore(games[2]) === 100
)
check(
  'public rating does not supply personal score',
  games[0].Rating.Value === 9.5 && personalScore(games[0]) === null
)
check(
  'missing or invalid personal score stays unavailable',
  personalScore({ Rating: { Value: 9 } }) === undefined &&
    personalScore({ MyRate: -1 }) === undefined &&
    personalScore({ MyRate: 11 }) === undefined
)
check(
  'six source states retain their declared meanings',
  games.every((game) => states[game.PlayType]) &&
    states[0].status === null &&
    states[1].status === 'active' &&
    states[2].completed &&
    states[3].status === 'onHold' &&
    states[5].status === 'planned'
)
check(
  'abandoned has no native current-state substitute',
  states[4].status === undefined && states[4].completed === false
)
check(
  'play count is independent of at-least-once completion',
  games[2].PlayCount === 17 && states[games[2].PlayType].completed === true
)
check(
  'plain private comment retains literal markup and line breaks',
  games[0].Comment === '普通私人文字\n<不是 HTML> & 保留换行' && games[0].PrivateComment === true
)
check(
  'cumulative minutes are converted once',
  totalMilliseconds(games[0]) === 4500000 &&
    Object.values(games[0].PlayedTime).reduce((sum, n) => sum + n, 0) === 75
)
check(
  'explicit source total is the selected aggregate',
  totalMilliseconds({ TotalPlayTime: 80, PlayedTime: { day: 75 } }) === 4800000
)
check(
  'day totals can supply an absent aggregate without parsing locale dates',
  totalMilliseconds({ PlayedTime: { '7/3/2025': 30, '2025/7/4': 45 } }) === 4500000
)
check(
  'invalid and overflowing durations are not adopted',
  totalMilliseconds({ TotalPlayTime: -1 }) === undefined &&
    totalMilliseconds({ TotalPlayTime: Number.MAX_SAFE_INTEGER }) === undefined
)
check(
  'valid first-of-year date differs from the explicit minimum-date sentinel',
  games[0].ReleaseDate.Value === '2020-01-01T00:00:00' &&
    games[5].ReleaseDate.Value === '0001-01-01T00:00:00'
)
check(
  'new export migration flags are not a reason to reject the format',
  status.GalgameMultiInstallUpgrade === false && status.GameLiteDbUpgrade === false
)
check(
  'seven library entries refer to six logical games',
  allEntries.length === 7 && allEntries.every(({ entry }) => byId.has(entry.Galgame))
)
check(
  'five local installations exclude archive and virtual entries',
  installations.length === 5 && allEntries.length - installations.length === 2
)
check(
  'two installations remain attached to one work',
  localTwo.length === 2 && localTwo[0].entry.EntryId !== localTwo[1].entry.EntryId
)
check(
  'instance configuration takes precedence over root compatibility fields',
  localTwo[1].entry.LocalConfig.ExePath === 'D:\\Synthetic Library B\\Two\\launcher.exe' &&
    byId.get(guid(2)).ExePath !== localTwo[1].entry.LocalConfig.ExePath
)
check(
  'recent source installation remains a separate source fact',
  byId.get(guid(2)).PreferredInstallationId === guid(102) &&
    localTwo[0].entry.LocalConfig.LastSuccessfulLaunchTime === '2025-07-04T18:00:00'
)
const firstConfig = installations[0].entry.LocalConfig
check(
  'one ArgumentList item preserves all source argument text',
  sourceArguments(firstConfig).argv.length === 1 &&
    sourceArguments(firstConfig).argv[0] === '--label "A & B" 100%'
)
check(
  'null and empty source arguments remain different',
  sourceArguments({ ExePath: 'synthetic.exe', ExeArguments: null }).argv.length === 0 &&
    sourceArguments({ ExePath: 'synthetic.exe', ExeArguments: '' }).argv[0] === ''
)
const localeConfig = installations.find(({ entry }) => entry.Galgame === guid(3)).entry.LocalConfig
check(
  'locale tool mode uses game executable as its single argument',
  sourceArguments(localeConfig, 'C:\\Synthetic Tools\\LE.exe').argv[0] === localeConfig.ExePath &&
    sourceArguments(localeConfig) === null
)
check(
  'portable save path keeps token and old root distinct',
  firstConfig.DetectedSavePath.ParsedPath === '%GameRoot%\\save' &&
    firstConfig.DetectedSavePath.Mapping.Tag === '%GameRoot%'
)
check(
  'custom categories are distinct from generated state categories',
  customGroups.length === 1 && groups.length === 2
)
check(
  'custom category membership and source order survive',
  JSON.stringify(customGroups[0].Categories[0].GalgamesX) === JSON.stringify([guid(2), guid(1)])
)
check(
  'staff participation links reference logical games',
  staff.length === 1 && staff[0].Games.every((game) => byId.has(game.GameId))
)
check(
  'character identity slots are not interpreted as game IDs',
  games[0].Characters[0].Ids[0] === 'c101' &&
    sourceIdentity(0, games[0].Characters[0].Ids[0]) === null
)
const imageNames = Object.keys(entries).filter((name) => name.startsWith('Images/'))
const imageReferences = [
  ...games.flatMap((game) => [
    game.ImagePath?.Value,
    game.HeaderImagePath?.Value,
    ...game.Characters.flatMap((character) => [character.ImagePath, character.PreviewImagePath])
  ]),
  ...sources.map((source) => source.ImagePath),
  ...groups.flatMap((group) => group.Categories.map((category) => category.ImagePath)),
  ...staff.map((person) => person.ImagePath)
].filter(Boolean)
check(
  'seven archive image files retain the supplied bytes',
  imageNames.length === 7 &&
    imageNames.every((name) =>
      Buffer.from(entries[name]).equals(readFileSync(join(root, 'meta-v2', 'cover.png')))
    )
)
check(
  'backslash image references resolve inside the archive',
  managedImage(games[0].ImagePath.Value) === 'Images/cover.png' &&
    imageReferences.every((reference) => !!entries[managedImage(reference)])
)
check(
  'application placeholders and outside paths are not archive image reads',
  managedImage('ms-appx:///Assets/WindowIcon.ico') === null &&
    managedImage('../outside.png') === null &&
    managedImage('C:\\outside.png') === null
)
const meta = JSON.parse(readFileSync(join(root, 'meta-v2', 'meta.json'), 'utf8'))
const matchesMetaVersion = (value) =>
  value &&
  value.Version === 2 &&
  value.Game &&
  typeof value.Game === 'object' &&
  !Array.isArray(value.Game) &&
  typeof value.Game.Uuid === 'string' &&
  value.Game.Name &&
  typeof value.Game.Name.Value === 'string'
check(
  'version-two metadata separates game and installation',
  matchesMetaVersion(meta) &&
    meta.Game.Uuid === guid(2) &&
    meta.Installation.ExePath !== meta.Game.ExePath
)
check(
  'future and unversioned metadata are not treated as version two',
  !matchesMetaVersion({ ...meta, Version: 3 }) &&
    !matchesMetaVersion(meta.Game) &&
    !matchesMetaVersion({ Version: 2, Game: [] })
)
check(
  'metadata cover resolves; mismatched header reference remains missing',
  existsSync(join(root, 'meta-v2', managedImage(meta.Game.ImagePath.Value))) &&
    !existsSync(join(root, 'meta-v2', managedImage(meta.Game.HeaderImagePath.Value)))
)
check(
  'a similarly named copied header is not silently substituted',
  existsSync(join(root, 'meta-v2', 'Synthetic visual novel 2_Header.png')) &&
    meta.Game.HeaderImagePath.Value === '.\\old-header-name.png'
)
check(
  'unknown type labels remain ordinary JSON data',
  JSON.parse('{"$type":"Synthetic.Unavailable.Type","Value":"plain"}').$type ===
    'Synthetic.Unavailable.Type'
)
check('input archive bytes are unchanged', hash(readFileSync(archivePath)) === before)
console.log(
  JSON.stringify(
    {
      passed: tests.length,
      tests,
      summary: {
        games: games.length,
        libraries: sources.length,
        libraryEntries: allEntries.length,
        localInstallations: installations.length,
        customGroups: customGroups.length,
        images: imageNames.length,
        imageReferences: imageReferences.length,
        metadataVersion: meta.Version,
        missingMetadataImages: 1
      },
      archive: { bytes: bytes.length, sha256: before },
      scope:
        'Synthetic source decoding and specified normalization only; no real app export or native Kisaki writes.'
    },
    null,
    2
  )
)
