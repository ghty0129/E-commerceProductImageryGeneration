import { useState } from 'react'
import { runBoundedProjectQueue } from '../lib/boundedProjectQueue'

type Slot = { id: string; name: string; status: '待配置' | '排队中' | '处理中' | '已完成' | '失败' }
const initial: Slot[] = Array.from({ length: 5 }, (_, index) => ({ id: `project-${index + 1}`, name: `项目 ${index + 1}`, status: '待配置' }))

export default function BatchProjectWorkspace({ onRunProject = async () => undefined }: { onRunProject?: (id: string) => Promise<void> }) {
  const [slots, setSlots] = useState(initial)
  const [selected, setSelected] = useState<string[]>([])
  const allSelected = selected.length === slots.length
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const [running, setRunning] = useState(false)
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
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{slots.map((slot) => <div key={slot.id} className={`rounded-xl border p-3 ${selected.includes(slot.id) ? 'border-blue-400 bg-blue-50 dark:bg-blue-400/10' : 'border-gray-200 dark:border-white/10'}`}><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selected.includes(slot.id)} onChange={() => toggle(slot.id)} />{slot.name}</label><input value={slot.name} onChange={(e) => setSlots((current) => current.map((item) => item.id === slot.id ? { ...item, name: e.target.value } : item))} className="mt-2 w-full rounded border px-2 py-1 text-xs dark:bg-gray-950" /><div className="mt-2 text-[11px] text-gray-500">{slot.status}</div></div>)}</div>
  </section>
}
