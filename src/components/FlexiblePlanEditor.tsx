import { addPlannedImage, createImageSetPlan as createPlan, confirmImageSetPlan, copyPlannedImage, deletePlannedImage, isImageSetPlanConfirmed, movePlannedImage, selectPlannedImage, updatePlannedImage, type ImageSetPlan, type PlannedImage } from '../lib/imageSetPlan'
import { useState } from 'react'

const field = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950 dark:text-white'

export default function FlexiblePlanEditor({ plan, onChange, requestedCount = 4, description = '', onApplySelected, referenceCount = 0 }: { plan: ImageSetPlan; onChange: (plan: ImageSetPlan) => void; requestedCount?: number; description?: string; onApplySelected?: () => void; referenceCount?: number }) {
  const [reconstructionIntensity, setReconstructionIntensity] = useState('标准重构')
  const selected = plan.images.find((image) => image.id === plan.selectedImageId) ?? plan.images[0]
  const update = (changes: Partial<Omit<PlannedImage, 'id'>>) => onChange(updatePlannedImage(plan, selected.id, changes))
  const newId = () => `${plan.mode}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const autoPlan = () => {
    const count = Math.min(12, Math.max(1, requestedCount))
    const purposes = ['商品主视觉', '使用场景', '核心细节', '竖版海报', '卖点展示', '尺寸信息', '包装清单', '对比展示']
    let next = createPlan(plan.mode, count, (index) => `${plan.mode}-auto-${Date.now()}-${index}`)
    next = { ...next, images: next.images.map((image, index) => ({ ...image, purpose: purposes[index % purposes.length], goal: description, aspectRatio: purposes[index % purposes.length] === '竖版海报' ? '9:16' : '1:1' })) }
    onChange(next)
  }
  const reconstruct = () => {
    const count = Math.min(12, Math.max(1, referenceCount))
    let next = createPlan(plan.mode, count, (index) => `${plan.mode}-rebuild-${Date.now()}-${index}`)
    next = { ...next, images: next.images.map((image, index) => ({ ...image, purpose: `参考图 ${index + 1} 对应新图`, goal: `${reconstructionIntensity}：保留营销目的，不复制原图；允许重新设计背景、人物、道具和构图。${description}`, perImageRequirements: '保持商品真实特征，重新生成文案，不复制第三方品牌、固定版式或人物姿势。' })) }
    onChange(next)
  }
  return <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-gray-900">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-bold">逐图方案 · {plan.images.length} 张</div><div className="text-xs text-gray-500">每张图可以独立设置用途、比例、文案和要求。</div></div><div className="flex flex-wrap gap-2"><button onClick={autoPlan} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white">按描述生成方案</button>{referenceCount > 0 ? <><select value={reconstructionIntensity} onChange={(e) => setReconstructionIntensity(e.target.value)} className="rounded-lg border px-2 text-xs"><option>轻度重构</option><option>标准重构</option><option>深度原创</option></select><button onClick={reconstruct} className="rounded-lg bg-purple-600 px-3 py-2 text-xs text-white">按 {referenceCount} 张参考图重构</button></> : null}<button disabled={plan.images.length >= 12} onClick={() => onChange(addPlannedImage(plan, newId))} className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white">新增图片</button><button onClick={() => onChange(confirmImageSetPlan(plan))} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white">确认整套方案</button></div></div>
    <div className="mt-3 flex gap-2 overflow-x-auto">{plan.images.map((image, index) => <button key={image.id} onClick={() => onChange(selectPlannedImage(plan, image.id))} className={`min-w-36 rounded-lg border p-2 text-left text-xs ${image.id === selected.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}><b>{index + 1}. {image.purpose}</b><span className="mt-1 block text-gray-500">{image.aspectRatio} · {image.resolution}</span></button>)}</div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs">图片用途<input aria-label="图片用途" className={field} value={selected.purpose} onChange={(e) => update({ purpose: e.target.value })} /></label>
      <label className="text-xs">画面目标<input className={field} value={selected.goal} onChange={(e) => update({ goal: e.target.value })} /></label>
      <label className="text-xs">构图<textarea className={field} value={selected.composition} onChange={(e) => update({ composition: e.target.value })} /></label>
      <label className="text-xs">图片文案<textarea className={field} value={selected.copy} onChange={(e) => update({ copy: e.target.value })} /></label>
      <label className="text-xs">比例<select className={field} value={selected.aspectRatio} onChange={(e) => update({ aspectRatio: e.target.value as PlannedImage['aspectRatio'] })}>{['1:1','4:5','3:4','16:9','9:16'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="text-xs">单张额外要求<textarea className={field} value={selected.perImageRequirements} onChange={(e) => update({ perImageRequirements: e.target.value })} /></label>
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => onChange(copyPlannedImage(plan, selected.id, newId))}>复制</button><button disabled={plan.images.indexOf(selected) === 0} onClick={() => onChange(movePlannedImage(plan, selected.id, plan.images.indexOf(selected)-1))}>上移</button><button disabled={plan.images.indexOf(selected) === plan.images.length-1} onClick={() => onChange(movePlannedImage(plan, selected.id, plan.images.indexOf(selected)+1))}>下移</button><button disabled={plan.images.length === 1} onClick={() => onChange(deletePlannedImage(plan, selected.id))} className="text-red-600">删除</button>{onApplySelected ? <button disabled={!isImageSetPlanConfirmed(plan)} onClick={onApplySelected} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white disabled:opacity-40">填入生图栏</button> : null}<span className={`ml-auto text-xs font-bold ${isImageSetPlanConfirmed(plan) ? 'text-emerald-600' : 'text-amber-600'}`}>{isImageSetPlanConfirmed(plan) ? '方案已确认' : '方案待确认'}</span></div>
  </div>
}
