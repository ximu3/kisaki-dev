/** @fileoverview Resolves workspace ownership and selects the verification groups reached by a Git diff. */

import { execFileSync } from 'node:child_process'
import { relative, sep } from 'node:path'

/** A registered workspace project and its repository-relative directory. */
export interface Project {
  name: string
  directory: string
}

/** The projects a group verifies and the project changes that can affect it. */
export interface ProjectGroup {
  name: string
  members: readonly string[]
  inputs: readonly string[]
}

/** Reads native pnpm workspace selectors, including their transitive dependency edges. */
export function listProjects(filter?: string): Project[] {
  const pnpm = process.env.npm_execpath
  if (!pnpm) {
    throw new Error('Run the verification planner through pnpm')
  }
  const selection = filter ? ['--filter', filter, '--fail-if-no-match'] : ['--recursive']
  const output = execFileSync(pnpm, [...selection, 'list', '--depth', '-1', '--json'], {
    encoding: 'utf8',
  })
  const projects = JSON.parse(output) as { name: string; path: string }[]
  return projects.map(({ name, path }) => ({
    name,
    directory: relative('.', path).split(sep).join('/'),
  }))
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
  const members = new Set(groups.flatMap((group) => group.members))
  const products = workspace
    .filter((project) => project.directory && !project.directory.startsWith('packages/'))
    .sort((left, right) => right.directory.length - left.directory.length)
  for (const project of products) {
    if (!members.has(project.name)) {
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
    const owner = products.find((project) => path.startsWith(project.directory + '/'))
    if (!owner) {
      return { scope: 'full', groups }
    }
    changed.add(owner.name)
  }
  return {
    scope: changed.size ? 'projects' : 'docs',
    groups: groups.filter(
      (group) =>
        group.members.some((name) => changed.has(name)) ||
        group.inputs.some((name) => changed.has(name)),
    ),
  }
}
