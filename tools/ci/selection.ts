/** @fileoverview Selects changed workspace packages and their dependents from the candidate tree. */

import { listProjects } from '../workspace.ts'
import type { Project } from '../workspace.ts'

/** Candidate packages included by the diff and the reason for their selection. */
export interface PackageSelection {
  scope: 'docs' | 'packages' | 'full'
  projects: readonly Project[]
}

/**
 * Attributes paths to the nearest workspace package. Repository inputs and missing baselines
 * select the entire workspace. Package-owned documentation follows its package.
 */
export function selectPackages(
  paths: readonly string[] | undefined,
  workspace: readonly Project[],
): PackageSelection {
  if (!paths) {
    return { scope: 'full', projects: workspace }
  }
  const owners = workspace
    .filter((project) => project.directory)
    .sort((left, right) => right.directory.length - left.directory.length)
  const changed = new Set<string>()
  for (const path of paths) {
    if (/^(?:[^/]+|refactor\/.+)\.md$/.test(path)) {
      continue
    }
    const owner = owners.find((project) => path.startsWith(project.directory + '/'))
    if (!owner) {
      return { scope: 'full', projects: workspace }
    }
    changed.add(owner.name)
  }

  if (!changed.size) {
    return { scope: 'docs', projects: [] }
  }
  const filters = [...changed].map((name) => '...' + name)
  return { scope: 'packages', projects: listProjects(...filters) }
}
