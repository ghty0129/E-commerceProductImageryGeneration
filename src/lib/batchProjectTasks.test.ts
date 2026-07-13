import { describe, expect, it } from 'vitest'
import { deriveBatchProjectStatus } from './batchProjectTasks'

describe('batch project task status', () => {
  it('restores a completed project from persisted task ids', () => {
    expect(deriveBatchProjectStatus(['task-1', 'task-2'], [
      { id: 'task-1', status: 'done' },
      { id: 'task-2', status: 'done' },
    ])).toBe('done')
  })

  it('keeps a project running while any linked task is running', () => {
    expect(deriveBatchProjectStatus(['task-1', 'task-2'], [
      { id: 'task-1', status: 'done' },
      { id: 'task-2', status: 'running' },
    ])).toBe('running')
  })

  it('marks a project failed when a linked task fails', () => {
    expect(deriveBatchProjectStatus(['task-1', 'task-2'], [
      { id: 'task-1', status: 'done' },
      { id: 'task-2', status: 'error' },
    ])).toBe('error')
  })

  it('keeps a submitted project recoverable while task history is loading', () => {
    expect(deriveBatchProjectStatus(['task-1'], [])).toBe('submitted')
  })
})
