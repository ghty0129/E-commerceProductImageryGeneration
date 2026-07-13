import { useEffect, useState } from 'react'
import { zipSync } from 'fflate'
import { runBoundedProjectQueue } from '../lib/boundedProjectQueue'
import { createBatchProjectArchiveFiles } from '../lib/batchProjectArchive'
import {
  BATCH_PROJECT_STATUS_LABELS,
  deriveBatchProjectStatus,
  type BatchProjectSlot,
  type BatchProjectStatus,
} from '../lib/batchProjectTasks'
import { ensureImageCached, useStore } from '../store'

export type { BatchProjectSlot } from '../lib/batchProjectTasks'

const STORAGE_KEY = 'amazon-image-studio-batch-slots-v1'
const PURPOSES = ['商品主视觉', '使用场景', '核心细节', '竖版海报', '卖点展示', '尺寸信息', '包装清单', '对比展示']

function createInitialSlots(): BatchProjectSlot[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `project-${index + 1}`,
    name: `项目 ${index + 1}`,
    sku: '',
    description: '',
    requirements: '',
    imageCount: 4,
    referenceImages: [],
    plannedImages: [],
    taskIds: [],
    status: 'draft',
  }))
}

function normalizeStatus(value: unknown): BatchProjectStatus {
  if (value === 'queued' || value === 'running' || value === 'submitted' || value === 'done' || value === 'error') return value
  return 'draft'
}

function loadSlots(): BatchProjectSlot[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!Array.isArray(value) || value.length !== 5) return createInitialSlots()
    return value.map((slot, index) => ({
      ...createInitialSlots()[index],
      ...slot,
      referenceImages: Array.isArray(slot.referenceImages) ? slot.referenceImages : [],
      plannedImages: Array.isArray(slot.plannedImages) ? slot.plannedImages : [],
      taskIds: Array.isArray(slot.taskIds) ? slot.taskIds.filter((id: unknown): id is string => typeof id === 'string' && Boolean(id)) : [],
      status: normalizeStatus(slot.status),
    }))
  } catch {
    return createInitialSlots()
  }
}

type Props = {
  onRunProject?: (slot: BatchProjectSlot, onTaskCreated: (taskId: string, imageIndex: number) => void) => Promise<void>
  onLoadProject?: (slot: BatchProjectSlot) => void
}

export default function BatchProjectWorkspace({ onRunProject, onLoadProject }: Props) {
  const [slots, setSlots] = useState<BatchProjectSlot[]>(() => typeof window === 'undefined' ? createInitialSlots() : loadSlots())
  const [selected, setSelected] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const tasks = useStore((state) => state.tasks)
  const allSelected = selected.length === slots.length

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)) } catch { /* best effort for large reference images */ }
  }, [slots])

  useEffect(() => {
    setSlots((current) => {
      let changed = false
      const next = current.map((slot) => {
        if (slot.taskIds.length === 0 || slot.status === 'queued') return slot
        const status = deriveBatchProjectStatus(slot.taskIds, tasks)
        if (status === slot.status) return slot
        changed = true
        return { ...slot, status }
      })
      return changed ? next : current
    })
  }, [tasks])

  const patchSlot = (id: string, changes: Partial<BatchProjectSlot>) => {
    setSlots((current) => current.map((slot) => slot.id === id ? { ...slot, ...changes } : slot))
  }

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const addReferences = async (slot: BatchProjectSlot, files: FileList | null) => {
    if (!files) return
    const selectedFiles = Array.from(files).slice(0, Math.max(0, 6 - slot.referenceImages.length))
    const urls = await Promise.all(selectedFiles.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })))
    patchSlot(slot.id, { referenceImages: [...slot.referenceImages, ...urls] })
  }

  const exportProject = async (slot: BatchProjectSlot) => {
    const files = await createBatchProjectArchiveFiles({ project: slot, tasks, resolveImage: ensureImageCached })
    const safeName = (slot.sku || slot.name || slot.id).replace(/[\\/:*?"<>|]+/g, '-').trim() || slot.id
    const zipped = new Uint8Array(zipSync(files))
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(new Blob([zipped.buffer], { type: 'application/zip' }))
    anchor.download = `${new Date().toISOString().slice(0, 10)}-${safeName}.zip`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000)
  }

  const runProjects = async (ids: string[]) => {
    if (!ids.length || running) return
    setRunning(true)
    setSlots((current) => current.map((slot) => ids.includes(slot.id) ? { ...slot, taskIds: [], status: 'queued' } : slot))
    const snapshot = slots.filter((slot) => ids.includes(slot.id))
    const results = await runBoundedProjectQueue(snapshot, async (slot) => {
      patchSlot(slot.id, { status: 'running' })
      const plannedImages = Array.from({ length: slot.imageCount }, (_, index) => ({
        purpose: PURPOSES[index % PURPOSES.length],
        goal: [slot.description, slot.requirements].filter(Boolean).join('；'),
        ...(slot.referenceImages.length ? { referenceIndex: index % slot.referenceImages.length } : {}),
      }))
      patchSlot(slot.id, { plannedImages })
      if (onRunProject) {
        await onRunProject({ ...slot, plannedImages, taskIds: [], status: 'running' }, (taskId, imageIndex) => {
          setSlots((current) => current.map((item) => {
            if (item.id !== slot.id) return item
            const taskIds = [...item.taskIds]
            taskIds[imageIndex] = taskId
            return { ...item, taskIds, status: 'running' }
          }))
        })
      }
    }, 2)
    setSlots((current) => current.map((slot) => {
      const result = results.find((item) => item.item.id === slot.id)
      if (!result) return slot
      return { ...slot, status: result.status === 'fulfilled' ? 'done' : 'error' }
    }))
    setRunning(false)
  }

  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">批量项目工作区</h2><p className="text-xs text-gray-500">5 个独立项目槽位 · 最多同时处理 2 个项目、每项目 2 张图</p></div>
        <div className="flex gap-2">
          <button disabled={running} onClick={() => setSelected(allSelected ? [] : slots.map((slot) => slot.id))} className="rounded-lg border px-3 py-2 text-xs">{allSelected ? '取消全选' : '全选'}</button>
          <button disabled={!selected.length || running} onClick={() => void runProjects(selected)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40">{running ? '队列执行中…' : `执行队列（${selected.length}）`}</button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {slots.map((slot) => (
          <div key={slot.id} className={`rounded-xl border p-3 ${selected.includes(slot.id) ? 'border-blue-400 bg-blue-50 dark:bg-blue-400/10' : 'border-gray-200 dark:border-white/10'}`}>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selected.includes(slot.id)} onChange={() => toggle(slot.id)} />{slot.name}</label>
            <input value={slot.name} onChange={(event) => patchSlot(slot.id, { name: event.target.value })} className="mt-2 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="项目名称" />
            <input value={slot.sku} onChange={(event) => patchSlot(slot.id, { sku: event.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="SKU / 标记" />
            <textarea value={slot.description} onChange={(event) => patchSlot(slot.id, { description: event.target.value })} className="mt-1 min-h-16 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="商品材质、尺寸、卖点" />
            <textarea value={slot.requirements} onChange={(event) => patchSlot(slot.id, { requirements: event.target.value })} className="mt-1 min-h-14 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="整套生图要求" />
            <label className="mt-1 flex items-center gap-2 text-[11px]">图片数<input type="number" min={1} max={12} value={slot.imageCount} onChange={(event) => patchSlot(slot.id, { imageCount: Math.min(12, Math.max(1, Number(event.target.value) || 1)), plannedImages: [], taskIds: [], status: 'draft' })} className="w-14 rounded border px-1 py-0.5 dark:bg-gray-950" /></label>
            <label className="mt-2 block cursor-pointer rounded border border-dashed p-2 text-center text-[11px]">上传参考图（{slot.referenceImages.length}/6）<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addReferences(slot, event.target.files)} /></label>
            <div className="mt-1 flex flex-wrap gap-1">{slot.referenceImages.map((url, index) => <button key={`${slot.id}-${index}`} title="点击删除" onClick={() => patchSlot(slot.id, { referenceImages: slot.referenceImages.filter((_, itemIndex) => itemIndex !== index) })}><img src={url} alt="" className="h-9 w-9 rounded object-cover" /></button>)}</div>
            {slot.plannedImages.length > 0 ? <div className="mt-2 rounded bg-emerald-50 p-2 text-[10px] text-emerald-800"><b>已生成 {slot.plannedImages.length} 张方案</b>{slot.plannedImages.slice(0, 4).map((image, index) => <div key={index}>{index + 1}. {image.purpose}{image.referenceIndex != null ? ` · 参考图 ${image.referenceIndex + 1}` : ''}</div>)}</div> : null}
            <div className="mt-2 text-[11px] text-gray-500">{BATCH_PROJECT_STATUS_LABELS[slot.status]}{slot.taskIds.length ? ` · ${slot.taskIds.length} 个任务` : ''}</div>
            {slot.status === 'error' ? <button type="button" disabled={running} onClick={() => void runProjects([slot.id])} className="mt-2 rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 disabled:opacity-40">重试该项目</button> : null}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{slots.map((slot) => <div key={`actions-${slot.id}`} className="flex rounded-lg border"><button type="button" disabled={!onLoadProject} onClick={() => onLoadProject?.(slot)} className="px-3 py-1.5 text-xs text-indigo-600 disabled:opacity-40">载入 {slot.name}</button><button type="button" onClick={() => void exportProject(slot)} className="border-l px-3 py-1.5 text-xs text-blue-600">导出 ZIP</button></div>)}</div>
    </section>
  )
}
