import { describe, expect, it } from 'vitest'
import { deriveBatchProjectStatus, getRetryableImageIndexes } from './batchProjectTasks'

describe('batch project task status', () => {
  it('restores a completed project from persisted task ids', () => {
    expect(deriveBatchProjectStatus(2, [{ imageIndex: 0, taskId: 'task-1' }, { imageIndex: 1, taskId: 'task-2' }], [
      { id: 'task-1', status: 'done' },
      { id: 'task-2', status: 'done' },
    ])).toBe('done')
  })

  it('keeps a project running while any linked task is running', () => {
    expect(deriveBatchProjectStatus(2, [{ imageIndex: 0, taskId: 'task-1' }, { imageIndex: 1, taskId: 'task-2' }], [
      { id: 'task-1', status: 'done' },
      { id: 'task-2', status: 'running' },
    ])).toBe('running')
  })

  it('marks a project failed when a linked task fails', () => {
    expect(deriveBatchProjectStatus(2, [{ imageIndex: 0, taskId: 'task-1' }, { imageIndex: 1, taskId: 'task-2' }], [
      { id: 'task-1', status: 'done' },
      { id: 'task-2', status: 'error' },
    ])).toBe('error')
  })

  it('keeps a submitted project recoverable while task history is loading', () => {
    expect(deriveBatchProjectStatus(1, [{ imageIndex: 0, taskId: 'task-1' }], [])).toBe('submitted')
  })

  it('does not report completion when only part of the planned set was submitted', () => {
    expect(deriveBatchProjectStatus(3, [{ imageIndex: 1, taskId: 'task-2' }], [
      { id: 'task-2', status: 'done' },
    ])).toBe('partial')
  })

  it('retries only missing and failed images', () => {
    expect(getRetryableImageIndexes(4, [
      { imageIndex: 0, taskId: 'done-1' },
      { imageIndex: 1, taskId: 'failed-1' },
      { imageIndex: 3, taskId: 'done-2' },
    ], [
      { id: 'done-1', status: 'done' },
      { id: 'failed-1', status: 'error' },
      { id: 'done-2', status: 'done' },
    ])).toEqual([1, 2])
  })
})
