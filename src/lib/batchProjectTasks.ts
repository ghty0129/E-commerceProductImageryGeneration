import type { TaskStatus } from '../types'

export type BatchProjectStatus = 'draft' | 'queued' | 'running' | 'submitted' | 'partial' | 'done' | 'error'

export type BatchImageTaskLink = { imageIndex: number; taskId: string }

export type ProjectImagePlan = {
  purpose: string
  goal: string
  referenceIndex?: number
}

export type BatchProjectSlot = {
  id: string
  name: string
  sku: string
  description: string
  requirements: string
  imageCount: number
  referenceImages: string[]
  plannedImages: ProjectImagePlan[]
  taskLinks: BatchImageTaskLink[]
  status: BatchProjectStatus
}

type LinkedTask = { id: string; status: TaskStatus }

export function deriveBatchProjectStatus(expectedImageCount: number, taskLinks: BatchImageTaskLink[], tasks: LinkedTask[]): BatchProjectStatus {
  if (taskLinks.length === 0) return 'draft'
  const linked = taskLinks.map((link) => tasks.find((task) => task.id === link.taskId)).filter(Boolean) as LinkedTask[]
  if (linked.length !== taskLinks.length) return 'submitted'
  if (linked.some((task) => task.status === 'running')) return 'running'
  if (linked.some((task) => task.status === 'error')) return 'error'
  if (taskLinks.length < expectedImageCount) return 'partial'
  return 'done'
}

export function getRetryableImageIndexes(expectedImageCount: number, taskLinks: BatchImageTaskLink[], tasks: LinkedTask[]): number[] {
  return Array.from({ length: expectedImageCount }, (_, imageIndex) => imageIndex).filter((imageIndex) => {
    const link = taskLinks.find((item) => item.imageIndex === imageIndex)
    if (!link) return true
    return tasks.find((task) => task.id === link.taskId)?.status === 'error'
  })
}

export const BATCH_PROJECT_STATUS_LABELS: Record<BatchProjectStatus, string> = {
  draft: '待配置',
  queued: '排队中',
  running: '生成中',
  submitted: '已提交，等待任务记录',
  partial: '未完成，可继续',
  done: '已完成',
  error: '生成失败',
}
