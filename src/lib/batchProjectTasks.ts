import type { TaskStatus } from '../types'

export type BatchProjectStatus = 'draft' | 'queued' | 'running' | 'submitted' | 'done' | 'error'

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
  taskIds: string[]
  status: BatchProjectStatus
}

type LinkedTask = { id: string; status: TaskStatus }

export function deriveBatchProjectStatus(taskIds: string[], tasks: LinkedTask[]): BatchProjectStatus {
  const persistedIds = taskIds.filter((id): id is string => typeof id === 'string' && Boolean(id))
  if (persistedIds.length === 0) return 'draft'
  const linked = persistedIds.map((id) => tasks.find((task) => task.id === id)).filter(Boolean) as LinkedTask[]
  if (linked.length !== persistedIds.length) return 'submitted'
  if (linked.some((task) => task.status === 'running')) return 'running'
  if (linked.some((task) => task.status === 'error')) return 'error'
  return 'done'
}

export const BATCH_PROJECT_STATUS_LABELS: Record<BatchProjectStatus, string> = {
  draft: '待配置',
  queued: '排队中',
  running: '生成中',
  submitted: '已提交，等待任务记录',
  done: '已完成',
  error: '生成失败',
}
