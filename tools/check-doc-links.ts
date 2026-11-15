/** @fileoverview Checks local Markdown links against the candidate checkout and its explicit or heading anchors. */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/** Markdown files and their available fragment identifiers, shared across referring pages. */
const anchors = new Map<string, Set<string>>()

/** Collects GitHub-style heading slugs and explicit HTML anchors outside fenced code examples. */
function fragments(file: string) {
  const cached = anchors.get(file)
  if (cached) {
    return cached
  }
  const source = readFileSync(file, 'utf8').replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```[^\n]*$/gm, '')
  const ids = new Set(
    [...source.matchAll(/<(?:a|span)\b[^>]*?\b(?:id|name)=["']([^"']+)["']/gi)].map(
      (match) => match[1]!,
    ),
  )
  const slugs = new Set<string>()
  for (const heading of source.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = heading[1]!
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\s-]/gu, '')
      .replace(/ /g, '-')
    let slug = base
    for (let suffix = 1; slugs.has(slug); suffix++) {
      slug = base + '-' + suffix
    }
    slugs.add(slug)
    ids.add(slug)
  }
  anchors.set(file, ids)
  return ids
}

/** Reports broken destinations in maintained documents; archived evidence stays tied to its original tree. */
const candidates = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(
    (file) =>
      file &&
      existsSync(file) &&
      !file.startsWith('refactor/verification/evidence/') &&
      !file.startsWith('refactor/implementation/archive/'),
  )
/** Number of invalid references found in the candidate tree. */
let broken = 0
for (const file of candidates) {
  const contents = readFileSync(file, 'utf8')
    .replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```[^\n]*$/gm, '')
    .replace(/`[^`\n]*`/g, '')
  for (const link of contents.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*["'])?\)/g)) {
    const href = link[1] ?? link[2]!
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) {
      continue
    }
    const [path, fragment] = href.split('#')
    const target = path ? resolve(dirname(file), decodeURIComponent(path)) : resolve(file)
    if (
      !existsSync(target) ||
      (fragment &&
        target.endsWith('.md') &&
        statSync(target).isFile() &&
        !fragments(target).has(decodeURIComponent(fragment)))
    ) {
      console.error(file + ' → ' + href)
      broken++
    }
  }
}
console.info(candidates.length + ' Markdown files checked, ' + broken + ' unresolved links')
if (broken) {
  process.exitCode = 1
}
