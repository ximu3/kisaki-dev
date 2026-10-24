// Cases exercise archive namespace rules independently of the decoder's extraction semantics.
import { createMemberIndex, MemberFailure } from './members.mjs'
const file = (name, extra = {}) => ({ name, directory: false, redirection: 0, ...extra })
const link = (name, target, redirection = 1, extra = {}) =>
  file(name, { target, redirection, ...extra })
export function runPolicyCases() {
  const cases = [
    {
      id: 'relative-symbolic-link',
      entries: [file('a/data'), link('a/link', 'data')],
      path: 'a/link',
      target: 'a/data'
    },
    {
      id: 'rooted-hardlink',
      entries: [file('data/file'), link('refs/link', 'data/file', 4)],
      path: 'refs/link',
      target: 'data/file'
    },
    {
      id: 'rooted-copy',
      entries: [file('data/file'), link('refs/copy', 'data/file', 5)],
      path: 'refs/copy',
      target: 'data/file'
    },
    {
      id: 'chained-reference',
      entries: [file('data'), link('a', 'b'), link('b', 'data', 5)],
      path: 'a',
      target: 'data'
    },
    {
      id: 'directory-prefix',
      entries: [file('real/child'), link('alias', 'real', 2, { directoryTarget: true })],
      path: 'alias/child',
      target: 'real/child'
    },
    {
      id: 'relative-junction',
      entries: [file('real/child'), link('alias', 'real', 3, { directoryTarget: true })],
      path: 'alias/child',
      target: 'real/child'
    },
    {
      id: 'parent-after-reference',
      entries: [
        file('target/file'),
        file('target/deep', { directory: true }),
        link('folder/alias', '../target/deep', 2, { directoryTarget: true })
      ],
      path: 'folder/alias/../file',
      target: 'target/file'
    },
    {
      id: 'legacy-directory-target',
      entries: [file('real/child'), link('old', 'real', 1, { targetInData: true })],
      path: 'old/child',
      target: 'real/child'
    },
    {
      id: 'windows-reference-separators',
      entries: [file('a/data'), link('links/ref', '..\\a\\data', 2)],
      path: 'links/ref',
      target: 'a/data'
    },
    {
      id: 'unix-backslash-name',
      entries: [file('a\\b'), link('alias', 'a\\b')],
      path: 'alias',
      target: 'a\\b'
    },
    {
      id: 'literal-percent-name',
      entries: [file('%2e%2e/file'), link('alias', '%2e%2e/file')],
      path: 'alias',
      target: '%2e%2e/file'
    },
    {
      id: 'case-sensitive-name',
      entries: [file('A'), file('a'), link('alias', 'A')],
      path: 'alias',
      target: 'A'
    },
    {
      id: 'unicode-composition-preserved',
      entries: [file('é'), file('e\u0301'), link('alias', 'e\u0301')],
      path: 'alias',
      target: 'e\u0301'
    },
    {
      id: 'missing-target',
      entries: [link('alias', 'absent')],
      path: 'alias',
      error: 'missingTarget'
    },
    {
      id: 'root-escape',
      entries: [link('alias', '../outside')],
      path: 'alias',
      error: 'outsideArchive'
    },
    {
      id: 'absolute-target',
      entries: [link('alias', '/outside')],
      path: 'alias',
      error: 'outsideArchive'
    },
    {
      id: 'drive-target',
      entries: [link('alias', 'C:\\outside', 2)],
      path: 'alias',
      error: 'outsideArchive'
    },
    {
      id: 'network-share-target',
      entries: [link('alias', '\\\\server\\share', 2)],
      path: 'alias',
      error: 'outsideArchive'
    },
    { id: 'self-cycle', entries: [link('a', 'a')], path: 'a', error: 'referenceCycle' },
    {
      id: 'pair-cycle',
      entries: [link('a', 'b'), link('b', 'a')],
      path: 'a',
      error: 'referenceCycle'
    },
    {
      id: 'prefix-escape',
      entries: [link('up', '..', 1, { directoryTarget: true }), file('up/file')],
      path: 'up/file',
      error: 'outsideArchive'
    },
    {
      id: 'duplicate-member',
      entries: [file('a'), file('a'), link('alias', 'a')],
      path: 'alias',
      error: 'ambiguousTarget'
    },
    {
      id: 'normalized-collision',
      entries: [file('./a'), file('a')],
      path: 'a',
      error: 'ambiguousTarget'
    },
    {
      id: 'file-as-directory',
      entries: [file('a'), file('a/child')],
      path: 'a/child',
      error: 'notDirectory'
    },
    {
      id: 'directory-flag-mismatch',
      entries: [file('a'), link('alias', 'a', 2, { directoryTarget: true })],
      path: 'alias',
      error: 'targetKindMismatch'
    },
    {
      id: 'unknown-redirection',
      entries: [link('alias', 'a', 99)],
      path: 'alias',
      error: 'unsupportedReference'
    },
    {
      id: 'reference-budget',
      entries: [...Array.from({ length: 66 }, (_, i) => link('a' + i, 'a' + (i + 1))), file('a66')],
      path: 'a0',
      error: 'referenceLimit'
    }
  ]
  return cases.map((item) => {
    try {
      const result = createMemberIndex(item.entries).resolve(item.path)
      if (item.error || result.target.name !== item.target || result.memberPath !== item.path)
        throw new Error('Member namespace result differs')
      return { id: item.id, target: result.target.name, identityPreserved: true }
    } catch (error) {
      if (!(error instanceof MemberFailure) || error.reason !== item.error) throw error
      return { id: item.id, rejected: error.reason }
    }
  })
}
