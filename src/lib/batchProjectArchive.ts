import { strToU8 } from 'fflate'
import type { TaskStatus } from '../types'
import type { BatchProjectSlot } from './batchProjectTasks'

type ArchiveTask = { id: string; status: TaskStatus; outputImages: string[]; error?: string | null }

function decodeDataUrl(dataUrl: string | undefined): { bytes: Uint8Array; extension: string } | null {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/)
  if (!match) return null
  const mime = match[1].toLowerCase()
  const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
  return { bytes: Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0)), extension }
}

export async function createBatchProjectArchiveFiles({
  project,
  tasks,
  resolveImage,
}: {
  project: BatchProjectSlot
  tasks: ArchiveTask[]
  resolveImage: (imageId: string) => Promise<string | undefined>
}): Promise<Record<string, Uint8Array>> {
  const linkedTasks = [...project.taskLinks].sort((a, b) => a.imageIndex - b.imageIndex).map((link) => tasks.find((task) => task.id === link.taskId)).filter(Boolean) as ArchiveTask[]
  const files: Record<string, Uint8Array> = {
    'project.json': strToU8(JSON.stringify({ ...project, referenceImages: undefined, tasks: linkedTasks }, null, 2)),
    'README.txt': strToU8('项目资料、逐图方案、参考图和生成结果。上架前仍需人工复核素材授权、文字准确性和平台规则。'),
  }

  project.referenceImages.forEach((dataUrl, index) => {
    const decoded = decodeDataUrl(dataUrl)
    if (decoded) files[`references/reference-${String(index + 1).padStart(2, '0')}.${decoded.extension}`] = decoded.bytes
  })

  for (let taskIndex = 0; taskIndex < linkedTasks.length; taskIndex += 1) {
    const task = linkedTasks[taskIndex]
    for (let imageIndex = 0; imageIndex < task.outputImages.length; imageIndex += 1) {
      const decoded = decodeDataUrl(await resolveImage(task.outputImages[imageIndex]))
      if (decoded) files[`generated/task-${String(taskIndex + 1).padStart(2, '0')}-image-${String(imageIndex + 1).padStart(2, '0')}.${decoded.extension}`] = decoded.bytes
    }
  }
  return files
}
