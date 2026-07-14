import { addPlannedImage, confirmImageSetPlan, copyPlannedImage, deletePlannedImage, isImageSetPlanConfirmed, movePlannedImage, selectPlannedImage, updatePlannedImage, type ImageSetPlan, type PlannedImage } from '../lib/imageSetPlan'
import { useState } from 'react'
import { createLocalImagePlan } from '../lib/localImagePlan'

const field = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950 dark:text-white'

export default function FlexiblePlanEditor({ plan, onChange, requestedCount = 4, description = '', onApplySelected, referenceCount = 0 }: { plan: ImageSetPlan; onChange: (plan: ImageSetPlan) => void; requestedCount?: number; description?: string; onApplySelected?: () => void | Promise<void>; referenceCount?: number }) {
  const [reconstructionIntensity, setReconstructionIntensity] = useState('标准重构')
  const selected = plan.images.find((image) => image.id === plan.selectedImageId) ?? plan.images[0]
  const update = (changes: Partial<Omit<PlannedImage, 'id'>>) => onChange(updatePlannedImage(plan, selected.id, changes))
  const newId = () => `${plan.mode}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const autoPlan = () => {
    const count = Math.min(12, Math.max(1, requestedCount))
    onChange(createLocalImagePlan({ mode: plan.mode, count, description, createId: (index) => `${plan.mode}-auto-${Date.now()}-${index}` }))
  }
  const reconstruct = () => {
    const count = Math.min(12, Math.max(1, referenceCount))
    onChange(createLocalImagePlan({ mode: plan.mode, count, description, reconstructionIntensity, referenceCount, createId: (index) => `${plan.mode}-rebuild-${Date.now()}-${index}` }))
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
    <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => onChange(copyPlannedImage(plan, selected.id, newId))}>复制</button><button disabled={plan.images.indexOf(selected) === 0} onClick={() => onChange(movePlannedImage(plan, selected.id, plan.images.indexOf(selected)-1))}>上移</button><button disabled={plan.images.indexOf(selected) === plan.images.length-1} onClick={() => onChange(movePlannedImage(plan, selected.id, plan.images.indexOf(selected)+1))}>下移</button><button disabled={plan.images.length === 1} onClick={() => onChange(deletePlannedImage(plan, selected.id))} className="text-red-600">删除</button>{onApplySelected ? <button disabled={!isImageSetPlanConfirmed(plan)} onClick={() => void onApplySelected()} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white disabled:opacity-40">填入中文提示词</button> : null}<span className={`ml-auto text-xs font-bold ${isImageSetPlanConfirmed(plan) ? 'text-emerald-600' : 'text-amber-600'}`}>{isImageSetPlanConfirmed(plan) ? '方案已确认' : '方案待确认'}</span></div>
    {referenceCount > 0 ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"><div className="font-bold">相似性风险复核 · 需要人工检查</div><div className="mt-2 grid gap-1 sm:grid-cols-2">{['第三方品牌或平台徽章','直接复制原图文案','高度相似的构图与道具','人物外观或姿势过度相似','包装外观未经授权复用','商品结构或数量失真','错误或未授权 Logo 使用','生成图仍残留参考图文字'].map((item) => <label key={item} className="flex items-center gap-2"><input type="checkbox" />{item}</label>)}</div><p className="mt-2 leading-relaxed opacity-80">此清单只能降低相似性风险，不构成无侵权证明、法律意见或平台审核保证。</p></div> : null}
  </div>
}
