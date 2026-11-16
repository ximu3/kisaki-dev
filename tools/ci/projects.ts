/** @fileoverview Maps changed project files to verification groups using registered ownership and dependencies. */

import type { Project } from '../workspace.ts'

/** The projects a group verifies and the project changes that can affect it. */
export interface ProjectGroup {
  name: string
  members: readonly Project[]
  inputs: readonly string[]
}

/**
 * Selects complete groups for the affected projects. Shared engineering inputs and missing
 * baselines select every group. A product workspace member needs an explicit verification owner.
 */
export function selectGroups<Group extends ProjectGroup>(
  paths: readonly string[] | undefined,
  workspace: readonly Project[],
  groups: readonly Group[],
) {
  const owners = groups
    .flatMap((group) => group.members)
    .sort((left, right) => right.directory.length - left.directory.length)
  const names = new Set(owners.map((project) => project.name))
  for (const project of workspace) {
    if (
      project.directory &&
      !project.directory.startsWith('packages/') &&
      !names.has(project.name)
    ) {
      throw new Error('No verification group owns workspace project ' + project.name)
    }
  }

  if (!paths) {
    return { scope: 'full', groups }
  }
  const changed = new Set<string>()
  for (const path of paths) {
    if (/^(?:[^/]+|refactor\/.+)\.md$/.test(path)) {
      continue
    }
    const owner = owners.find((project) => path.startsWith(project.directory + '/'))
    if (!owner) {
      return { scope: 'full', groups }
    }
    changed.add(owner.name)
  }
  return {
    scope: changed.size ? 'projects' : 'docs',
    groups: groups.filter(
      (group) =>
        group.members.some((project) => changed.has(project.name)) ||
        group.inputs.some((name) => changed.has(name)),
    ),
  }
}
