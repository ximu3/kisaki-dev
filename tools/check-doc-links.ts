import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { repositoryRoot } from './workspace.ts'

const fencedCode = /^\s*```[^\n]*\n[\s\S]*?^\s*```[^\n]*$/gm

function documentAnchors(file: string): Set<string> {
  const source = readFileSync(file, 'utf8').replace(fencedCode, '')
  const anchors = new Set(
    [...source.matchAll(/<(?:a|span)\b[^>]*?\b(?:id|name)=["']([^"']+)["']/gi)].map(
      (match) => match[1]!,
    ),
  )

  const headingSlugs = new Set<string>()
  for (const heading of source.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = heading[1]!
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\s-]/gu, '')
      .replace(/ /g, '-')
    let slug = base
    for (let suffix = 1; headingSlugs.has(slug); suffix++) {
      slug = base + '-' + suffix
    }
    headingSlugs.add(slug)
    anchors.add(slug)
  }

  return anchors
}

export function checkDocumentLinks() {
  const anchorsByDocument = new Map<string, Set<string>>()
  function hasAnchor(file: string, anchor: string): boolean {
    let anchors = anchorsByDocument.get(file)
    if (!anchors) {
      anchors = documentAnchors(file)
      anchorsByDocument.set(file, anchors)
    }
    return anchors.has(anchor)
  }

  // Archived evidence refers to its original tree.
  const markdownFiles = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )
    .split('\0')
    .filter(
      (file) =>
        file &&
        existsSync(resolve(repositoryRoot, file)) &&
        !file.startsWith('refactor/verification/evidence/') &&
        !file.startsWith('refactor/implementation/archive/'),
    )

  let broken = 0
  for (const file of markdownFiles) {
    const document = resolve(repositoryRoot, file)
    const contents = readFileSync(document, 'utf8')
      .replace(fencedCode, '')
      .replace(/`[^`\n]*`/g, '')
    for (const link of contents.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*["'])?\)/g)) {
      const href = link[1] ?? link[2]!
      if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) {
        continue
      }

      const [path, fragment] = href.split('#')
      const target = path ? resolve(dirname(document), decodeURIComponent(path)) : document
      if (
        !existsSync(target) ||
        (fragment &&
          target.endsWith('.md') &&
          statSync(target).isFile() &&
          !hasAnchor(target, decodeURIComponent(fragment)))
      ) {
        console.error(file + ' → ' + href)
        broken++
      }
    }
  }

  return { checked: markdownFiles.length, broken }
}

if (import.meta.main) {
  const { checked, broken } = checkDocumentLinks()
  console.info(checked + ' Markdown files checked, ' + broken + ' unresolved links')
  if (broken) {
    process.exitCode = 1
  }
}
