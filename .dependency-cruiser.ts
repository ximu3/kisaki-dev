import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { IConfiguration, IRegularForbiddenRuleType } from 'dependency-cruiser'
import { listProjects, repositoryRoot, type Project } from './tools/workspace.ts'

interface PackageDependencies {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

function librarySource(name: string, ...excluded: string[]) {
  return {
    path: '^clients/desktop/packages/' + name + '/src/',
    pathNot: ['\\.test\\.tsx?$', ...excluded],
  }
}

function ownedFiles(project: Project, projects: readonly Project[]): string {
  const prefix = project.directory ? project.directory + '/' : ''
  const children = projects
    .filter(({ directory }) => directory !== project.directory && directory.startsWith(prefix))
    .map(({ directory }) => RegExp.escape(directory.slice(prefix.length)) + '/')
  const start = '^' + RegExp.escape(prefix)
  return children.length ? start + '(?!(?:' + children.join('|') + '))' : start
}

function declaredManifests(file: string): Set<string> {
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as PackageDependencies
  const names = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  })
  const require = createRequire(file)
  const declared = new Set<string>()
  for (const name of names) {
    const installed = require.resolve
      .paths(name)
      ?.map((path) => join(path, name, 'package.json'))
      .find(existsSync)
    if (installed) {
      declared.add(realpathSync(installed))
    }
  }
  return declared
}

function workspaceImportRules(): IRegularForbiddenRuleType[] {
  const projects = listProjects()
  const members = projects.map((project) => ({
    ...project,
    path: ownedFiles(project, projects),
    manifest: realpathSync(join(repositoryRoot, project.directory, 'package.json')),
  }))
  const rules: IRegularForbiddenRuleType[] = []
  for (const member of members) {
    rules.push({
      name: 'use-workspace-exports-from-' + member.name,
      severity: 'error',
      from: { path: member.path },
      to: {
        pathNot: member.path,
        dependencyTypes: ['local'],
        dependencyTypesNot: ['aliased-subpath-import', 'aliased-workspace'],
      },
    })

    const declared = declaredManifests(member.manifest)
    const undeclared = members
      .filter((other) => other.directory && other !== member && !declared.has(other.manifest))
      .map((other) => other.path)
    if (undeclared.length) {
      rules.push({
        name: 'declare-workspace-dependencies-from-' + member.name,
        severity: 'error',
        from: { path: member.path },
        to: { path: undeclared },
      })
    }
  }
  return rules
}

export default {
  forbidden: [
    ...workspaceImportRules(),
    {
      name: 'desktop-native-is-main-only',
      severity: 'error',
      from: {
        path: [
          '(^|/)src/(?:renderer|preload|extension-host|shared)/',
          '^clients/desktop/app/tools/dev/renderer/',
        ],
      },
      to: { path: '^clients/desktop/app/native/' },
    },
    {
      name: 'use-desktop-native-import',
      severity: 'error',
      from: { pathNot: '^clients/desktop/app/native/' },
      to: { path: '^clients/desktop/app/native/', dependencyTypesNot: ['aliased-subpath-import'] },
    },
    {
      name: 'ui-only-consumes-appearance-within-desktop',
      severity: 'error',
      from: librarySource('desktop-ui'),
      to: {
        path: '^clients/desktop/(app|extensions)/|^clients/desktop/packages/(?!desktop-ui/|desktop-appearance/)',
      },
    },
    {
      name: 'ui-has-no-node-runtime',
      severity: 'error',
      from: librarySource('desktop-ui'),
      to: {
        dependencyTypes: ['core'],
      },
    },
    {
      name: 'rpc-has-no-host-or-product-dependencies',
      severity: 'error',
      from: librarySource('desktop-rpc'),
      to: {
        path: '^clients/desktop/(app|extensions)/|^clients/desktop/packages/(?!desktop-rpc/)|(^|/)node_modules/(electron|solid-js)/',
      },
    },
    {
      name: 'rpc-has-no-node-runtime',
      severity: 'error',
      from: librarySource('desktop-rpc'),
      to: {
        dependencyTypes: ['core'],
      },
    },
    {
      name: 'contracts-have-no-node-runtime',
      severity: 'error',
      from: librarySource('desktop-contracts'),
      to: {
        dependencyTypes: ['core'],
      },
    },
    {
      name: 'contracts-have-no-application-or-ui-runtime',
      severity: 'error',
      from: librarySource('desktop-contracts'),
      to: {
        path: '^clients/desktop/app/|^clients/desktop/extensions/|(^|/)node_modules/(electron|solid-js)/',
      },
    },
    {
      name: 'contracts-do-not-import-localization',
      severity: 'error',
      from: librarySource('desktop-contracts'),
      to: {
        path: '^clients/desktop/packages/desktop-localization/',
      },
    },
    {
      name: 'localization-has-no-node-runtime',
      severity: 'error',
      from: librarySource('desktop-localization'),
      to: {
        dependencyTypes: ['core'],
      },
    },
    {
      name: 'localization-has-no-application-or-ui-runtime',
      severity: 'error',
      from: librarySource('desktop-localization'),
      to: {
        path: '^clients/desktop/app/|^clients/desktop/extensions/|(^|/)node_modules/(electron|solid-js)/',
      },
    },
    {
      name: 'distribution-pure-has-no-node-runtime',
      severity: 'error',
      from: librarySource('extension-distribution', '/src/node/'),
      to: {
        dependencyTypes: ['core'],
      },
    },
    {
      name: 'distribution-pure-does-not-import-signing',
      severity: 'error',
      from: librarySource('extension-distribution', '/src/node/'),
      to: {
        path: '^clients/desktop/packages/extension-distribution/src/node/',
      },
    },
    {
      name: 'distribution-has-no-application-runtime',
      severity: 'error',
      from: librarySource('extension-distribution'),
      to: {
        path: '^clients/desktop/app/|^clients/desktop/extensions/|^clients/desktop/packages/(desktop-|extension-sdk|extension-cli)',
      },
    },
    {
      name: 'appearance-has-no-node-runtime',
      severity: 'error',
      from: librarySource('desktop-appearance'),
      to: {
        dependencyTypes: ['core'],
      },
    },
    {
      name: 'appearance-has-no-application-runtime',
      severity: 'error',
      from: librarySource('desktop-appearance'),
      to: {
        path: '^clients/desktop/app/|^clients/desktop/extensions/',
      },
    },
    {
      name: 'no-cycles',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: 'no-undeclared-packages',
      severity: 'error',
      from: {},
      to: {
        dependencyTypes: ['npm-no-pkg', 'npm-unknown'],
      },
    },
    {
      name: 'runtime-does-not-import-engineering',
      severity: 'error',
      from: {
        path: '(^|/)(src|native/node)/',
        pathNot: '(^|/)(tests|fixtures)/|\\.test\\.tsx?$|^packages/(tooling|config)/',
      },
      to: {
        path: '^packages/(tooling|config)/|(^|/)tools/',
      },
    },
    {
      name: 'no-test-imports-outside-tests',
      severity: 'error',
      from: {
        pathNot: '(^|/)(tests|fixtures)/|\\.test\\.tsx?$|^packages/tooling/src/testing/',
      },
      to: {
        path: '(^|/)(tests|fixtures)/|\\.test\\.tsx?$|^packages/tooling/src/testing/',
      },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    doNotFollow: {
      path: '^refactor/|^artifacts/|(^|/)(node_modules|dist|out|target|test-results|playwright-report|coverage|\\.git|\\.cache|\\.local|\\.vitest)/|(^|/)tests/consumers/fixtures/',
    },
    enhancedResolveOptions: {
      conditionNames: ['types', 'import', 'node', 'default'],
      exportsFields: ['exports'],
    },
  },
} satisfies IConfiguration
