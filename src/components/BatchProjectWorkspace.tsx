import { useEffect, useState } from 'react'
import { runBoundedProjectQueue } from '../lib/boundedProjectQueue'

type Slot = { id: string; name: string; sku: string; description: string; requirements: string; imageCount: number; referenceImages: string[]; status: '待配置' | '排队中' | '处理中' | '已完成' | '失败' }
const initial: Slot[] = Array.from({ length: 5 }, (_, index) => ({ id: `project-${index + 1}`, name: `项目 ${index + 1}`, sku: '', description: '', requirements: '', imageCount: 4, referenceImages: [], status: '待配置' }))
const loadSlots = () => { try { const value = JSON.parse(localStorage.getItem('amazon-image-studio-batch-slots-v1') ?? 'null'); return Array.isArray(value) && value.length === 5 ? value as Slot[] : initial } catch { return initial } }

export default function BatchProjectWorkspace({ onRunProject = async () => undefined }: { onRunProject?: (id: string) => Promise<void> }) {
  const [slots, setSlots] = useState<Slot[]>(() => typeof window === 'undefined' ? initial : loadSlots())
  const [selected, setSelected] = useState<string[]>([])
  const allSelected = selected.length === slots.length
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const [running, setRunning] = useState(false)
  useEffect(() => { try { localStorage.setItem('amazon-image-studio-batch-slots-v1', JSON.stringify(slots)) } catch { /* best effort */ } }, [slots])
  const patchSlot = (id: string, changes: Partial<Slot>) => setSlots((current) => current.map((slot) => slot.id === id ? { ...slot, ...changes } : slot))
  const addReferences = async (slot: Slot, files: FileList | null) => {
    if (!files) return
    const available = Math.max(0, 6 - (slot.referenceImages?.length ?? 0))
    const selectedFiles = Array.from(files).slice(0, available)
    const urls = await Promise.all(selectedFiles.map((file) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })))
    patchSlot(slot.id, { referenceImages: [...(slot.referenceImages ?? []), ...urls] })
  }
  const enqueue = async () => {
    const ids = [...selected]
    setRunning(true)
    setSlots((current) => current.map((slot) => ids.includes(slot.id) ? { ...slot, status: '排队中' } : slot))
    const results = await runBoundedProjectQueue(ids, async (id) => {
      setSlots((current) => current.map((slot) => slot.id === id ? { ...slot, status: '处理中' } : slot))
      await onRunProject(id)
    }, 2)
    setSlots((current) => current.map((slot) => {
      const result = results.find((item) => item.item === slot.id)
      return result ? { ...slot, status: result.status === 'fulfilled' ? '已完成' : '失败' } : slot
    }))
    setRunning(false)
  }
  return <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">批量项目工作区</h2><p className="text-xs text-gray-500">5 个独立项目槽位 · 最多同时处理 2 个项目</p></div><div className="flex gap-2"><button disabled={running} onClick={() => setSelected(allSelected ? [] : slots.map((slot) => slot.id))} className="rounded-lg border px-3 py-2 text-xs">{allSelected ? '取消全选' : '全选'}</button><button disabled={!selected.length || running} onClick={() => void enqueue()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40">{running ? '队列执行中…' : `执行队列（${selected.length}）`}</button></div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{slots.map((slot) => <div key={slot.id} className={`rounded-xl border p-3 ${selected.includes(slot.id) ? 'border-blue-400 bg-blue-50 dark:bg-blue-400/10' : 'border-gray-200 dark:border-white/10'}`}><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selected.includes(slot.id)} onChange={() => toggle(slot.id)} />{slot.name}</label><input value={slot.name} onChange={(e) => patchSlot(slot.id, { name: e.target.value })} className="mt-2 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="项目名称" /><input value={slot.sku} onChange={(e) => patchSlot(slot.id, { sku: e.target.value })} className="mt-1 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="SKU / 标记" /><textarea value={slot.description} onChange={(e) => patchSlot(slot.id, { description: e.target.value })} className="mt-1 min-h-16 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="商品材质、尺寸、卖点" /><textarea value={slot.requirements} onChange={(e) => patchSlot(slot.id, { requirements: e.target.value })} className="mt-1 min-h-14 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" placeholder="整套生图要求" /><label className="mt-1 flex items-center gap-2 text-[11px]">图片数<input type="number" min={1} max={12} value={slot.imageCount} onChange={(e) => patchSlot(slot.id, { imageCount: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })} className="w-14 rounded border px-1 py-0.5 dark:bg-gray-950" /></label><label className="mt-2 block cursor-pointer rounded border border-dashed p-2 text-center text-[11px]">上传参考图（{slot.referenceImages?.length ?? 0}/6）<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addReferences(slot, e.target.files)} /></label><div className="mt-1 flex flex-wrap gap-1">{(slot.referenceImages ?? []).map((url, index) => <button key={`${slot.id}-${index}`} title="点击删除" onClick={() => patchSlot(slot.id, { referenceImages: slot.referenceImages.filter((_, itemIndex) => itemIndex !== index) })}><img src={url} className="h-9 w-9 rounded object-cover" /></button>)}</div><div className="mt-2 text-[11px] text-gray-500">{slot.status}</div></div>)}</div>
  </section>
}
