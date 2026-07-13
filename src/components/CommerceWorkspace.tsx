import { useEffect, useMemo, useState } from 'react'
import AmazonPlanner from './AmazonPlanner'
import ProductFactsAssistantModal from './ProductFactsAssistantModal'
import PromptStructurePreview from './PromptStructurePreview'
import FlexiblePlanEditor from './FlexiblePlanEditor'
import { useStore } from '../store'
import { getAmazonPlannerProfile, validateApiProfile } from '../lib/apiProfiles'
import { CREATION_MODES, getCreationModePolicy, type CreationMode } from '../lib/creationModes'
import { createEmptyCreationWorkspace, loadCreationWorkspace, saveCreationWorkspace, type CreationWorkspace } from '../lib/creationWorkspace'
import { loadProductFactsWorkspace } from '../lib/productFactsWorkspace'
import { buildConfirmedProductFactsText, type ProductFactCard } from '../lib/productFacts'
import { compileImagePrompt, type CompiledImagePrompt } from '../lib/promptCompiler'
import {
  createEmptyPromptRequirementWorkspace,
  loadPromptRequirementWorkspace,
  savePromptRequirementWorkspace,
  type PromptRequirementWorkspace,
} from '../lib/promptRequirementsWorkspace'
import { createEmptyFlexiblePlanWorkspace, loadFlexiblePlanWorkspace, saveFlexiblePlanWorkspace, type FlexiblePlanWorkspace } from '../lib/flexiblePlanWorkspace'
import type { ImageSetPlan } from '../lib/imageSetPlan'

const FIELD_CLASS = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

function loadInitialWorkspace() {
  return typeof window === 'undefined' ? createEmptyCreationWorkspace() : loadCreationWorkspace(window.localStorage)
}

function loadFactCard() {
  return typeof window === 'undefined' ? null : loadProductFactsWorkspace(window.localStorage).card
}

function loadInitialPromptRequirements() {
  if (typeof window === 'undefined') return createEmptyPromptRequirementWorkspace()
  const legacy = loadCreationWorkspace(window.localStorage)
  return loadPromptRequirementWorkspace(window.localStorage, {
    universal: legacy.universal.globalRequirements,
    free: legacy.free.globalRequirements,
  })
}

export function CreationModeTabs({ activeMode, onChange }: { activeMode: CreationMode; onChange: (mode: CreationMode) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="创作模式">
      {CREATION_MODES.map((policy) => (
        <button key={policy.mode} type="button" aria-pressed={activeMode === policy.mode} onClick={() => onChange(policy.mode)}
          className={`rounded-xl border px-4 py-3 text-left transition ${activeMode === policy.mode ? 'border-blue-300 bg-blue-50 text-blue-800 ring-2 ring-blue-500/15 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-100' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/[0.06]'}`}>
          <span className="block text-sm font-bold">{policy.label}</span>
          <span className="mt-1 block text-xs leading-relaxed opacity-75">{policy.description}</span>
        </button>
      ))}
    </div>
  )
}

function ProductFactsSummary({ card }: { card: ProductFactCard | null }) {
  const confirmedCount = card?.confirmedFacts.length ?? 0
  const confirmedInferences = card?.inferences.filter((item) => item.confirmed).length ?? 0
  const total = confirmedCount + confirmedInferences
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-sm font-bold text-gray-900 dark:text-white">已确认商品事实</div><div className="mt-1 text-xs text-gray-500">三种模式共享同一份事实卡，未确认推测不会进入后续提示词。</div></div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{total} 项</span>
      </div>
      {total ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-700 dark:text-gray-200">
          {card?.confirmedFacts.map((fact) => <span key={fact.id} className="rounded-lg bg-gray-100 px-2 py-1 dark:bg-white/[0.06]">{fact.label}：{fact.value}</span>)}
          {card?.inferences.filter((item) => item.confirmed).map((fact) => <span key={fact.id} className="rounded-lg bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{fact.label}：{fact.value}</span>)}
        </div>
      ) : <div className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-500 dark:border-white/[0.08]">暂无已确认事实，请先使用商品资料助手。</div>}
    </div>
  )
}

function ModeRules({ mode }: { mode: CreationMode }) {
  const policy = getCreationModePolicy(mode)
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-900">
      <div className="text-sm font-bold text-gray-900 dark:text-white">当前生效规则</div>
      <div className="mt-3 space-y-2">
        {policy.rules.map((rule) => (
          <div key={rule.id} data-rule-id={rule.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-100"><span className={`h-2 w-2 rounded-full ${rule.level === 'hard' ? 'bg-red-500' : 'bg-blue-500'}`} />{rule.label}</div>
            <div className="mt-1 pl-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{rule.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CreationModeFoundationPanel({ mode, workspace, setWorkspace, onOpenFacts, factCard, globalRequirements, onGlobalRequirementsChange, compiledPrompt, flexiblePlan, onFlexiblePlanChange }: {
  mode: 'universal' | 'free'
  workspace: CreationWorkspace
  setWorkspace: React.Dispatch<React.SetStateAction<CreationWorkspace>>
  onOpenFacts: () => void
  factCard: ProductFactCard | null
  globalRequirements: string
  onGlobalRequirementsChange: (value: string) => void
  compiledPrompt: CompiledImagePrompt
  flexiblePlan?: ImageSetPlan
  onFlexiblePlanChange?: (plan: ImageSetPlan) => void
}) {
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-white/[0.08] dark:bg-gray-950 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-bold text-gray-900 dark:text-white">{mode === 'free' ? '自由创作工作台' : '平台通用工作台'}</h2><p className="mt-1 text-xs text-gray-500">整套要求会进入结构化提示词，并按模式独立保存。</p></div>
        <button type="button" onClick={onOpenFacts} className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500">商品资料助手</button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <ProductFactsSummary card={factCard} />
          {mode === 'universal' ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-900">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">目标平台</span><input value={workspace.universal.platform} onChange={(event) => setWorkspace((current) => ({ ...current, universal: { ...current.universal, platform: event.target.value } }))} className={FIELD_CLASS} placeholder="例如：Walmart / eBay / Temu / 独立站" /></label>
                <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">计划图片数</span><input type="number" min={1} max={12} value={workspace.universal.imageCount} onChange={(event) => setWorkspace((current) => ({ ...current, universal: { ...current.universal, imageCount: Math.min(12, Math.max(1, Number(event.target.value) || 1)) } }))} className={FIELD_CLASS} /></label>
              </div>
              <label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">整套要求</span><textarea value={globalRequirements} onChange={(event) => onGlobalRequirementsChange(event.target.value)} className={`${FIELD_CLASS} min-h-28 resize-y`} placeholder="例如：整套保持简洁科技风，商品外观必须一致，可加入自有品牌 Logo。" /></label>
              <label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">平台补充说明</span><textarea value={workspace.universal.platformNotes} onChange={(event) => setWorkspace((current) => ({ ...current, universal: { ...current.universal, platformNotes: event.target.value } }))} className={`${FIELD_CLASS} min-h-20 resize-y`} placeholder="填写你已知的平台尺寸、文字或上架要求。" /></label>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-900">
              <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">计划图片数</span><input type="number" min={1} max={12} value={workspace.free.imageCount} onChange={(event) => setWorkspace((current) => ({ ...current, free: { ...current.free, imageCount: Math.min(12, Math.max(1, Number(event.target.value) || 1)) } }))} className={`${FIELD_CLASS} max-w-40`} /></label>
              <label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">整套创作要求</span><textarea value={globalRequirements} onChange={(event) => onGlobalRequirementsChange(event.target.value)} className={`${FIELD_CLASS} min-h-32 resize-y`} placeholder="例如：生成 4 张，右下角添加半透明自有品牌水印；两张户外场景、一张细节、一张竖版海报。" /></label>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-700 dark:text-gray-200">
                {([['allowText', '允许图片文字'], ['allowOwnedLogo', '允许自有 Logo'], ['allowWatermark', '允许自有水印']] as const).map(([key, label]) => <label key={key} className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.05]"><input type="checkbox" checked={workspace.free[key]} onChange={(event) => setWorkspace((current) => ({ ...current, free: { ...current.free, [key]: event.target.checked } }))} />{label}</label>)}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4"><ModeRules mode={mode} /><PromptStructurePreview compiled={compiledPrompt} /></div>
      </div>
      {flexiblePlan && onFlexiblePlanChange ? <FlexiblePlanEditor plan={flexiblePlan} onChange={onFlexiblePlanChange} requestedCount={workspace[mode].imageCount} description={globalRequirements} /> : null}
    </section>
  )
}

export default function CommerceWorkspace() {
  const [workspace, setWorkspace] = useState<CreationWorkspace>(loadInitialWorkspace)
  const [promptRequirements, setPromptRequirements] = useState<PromptRequirementWorkspace>(loadInitialPromptRequirements)
  const [flexiblePlans, setFlexiblePlans] = useState<FlexiblePlanWorkspace>(() => typeof window === 'undefined' ? createEmptyFlexiblePlanWorkspace() : loadFlexiblePlanWorkspace(window.localStorage))
  const [showProductFactsAssistant, setShowProductFactsAssistant] = useState(false)
  const [factCard, setFactCard] = useState<ProductFactCard | null>(loadFactCard)
  const settings = useStore((state) => state.settings)
  const inputImages = useStore((state) => state.inputImages)
  const setShowSettings = useStore((state) => state.setShowSettings)
  const profile = getAmazonPlannerProfile(settings)
  const profileError = profile ? validateApiProfile(profile) : '未选择支持 Chat Completions 或 Responses API 的 AI 策划配置'

  useEffect(() => saveCreationWorkspace(window.localStorage, workspace), [workspace])
  useEffect(() => savePromptRequirementWorkspace(window.localStorage, promptRequirements), [promptRequirements])
  useEffect(() => saveFlexiblePlanWorkspace(window.localStorage, flexiblePlans), [flexiblePlans])

  const confirmedProductFacts = useMemo(() => factCard ? buildConfirmedProductFactsText(factCard) : '', [factCard])
  const genericMode = workspace.activeMode === 'free' ? 'free' : 'universal'
  const currentGenericPrompt = useMemo(() => {
    const composition = genericMode === 'universal'
      ? [`Target platform: ${workspace.universal.platform || 'Not specified'}.`, workspace.universal.platformNotes].filter(Boolean).join('\n')
      : [`Allow on-image text: ${workspace.free.allowText ? 'yes' : 'no'}.`, `Allow owned logo: ${workspace.free.allowOwnedLogo ? 'yes' : 'no'}.`, `Allow owned watermark: ${workspace.free.allowWatermark ? 'yes' : 'no'}.`].join('\n')
    return compileImagePrompt({
      mode: genericMode,
      globalRequirements: promptRequirements[genericMode].globalRequirements,
      confirmedProductFacts,
      imageGoal: `Plan a coherent set of ${workspace[genericMode].imageCount} product images.`,
      compositionAndCopy: composition,
      technicalRequirements: 'Per-image dimensions and output format will be selected with the image plan.',
    })
  }, [confirmedProductFacts, genericMode, promptRequirements, workspace])

  return (
    <>
      <section data-no-drag-select className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-gray-900 sm:p-5">
        <div className="mb-3"><h1 className="text-lg font-bold text-gray-900 dark:text-white">选择创作模式</h1><p className="mt-1 text-xs text-gray-500">不同模式使用独立规则和草稿，切换不会覆盖其他模式内容。</p></div>
        <CreationModeTabs activeMode={workspace.activeMode} onChange={(activeMode) => setWorkspace((current) => ({ ...current, activeMode }))} />
      </section>
      {workspace.activeMode === 'amazon' ? (
        <><section className="mt-4 grid gap-4 lg:grid-cols-2"><ProductFactsSummary card={factCard} /><ModeRules mode="amazon" /></section>
          <AmazonPlanner confirmedProductFacts={confirmedProductFacts} globalRequirements={promptRequirements.amazon.globalRequirements} perImageRequirements={promptRequirements.amazon.perImageRequirements}
            onGlobalRequirementsChange={(globalRequirements) => setPromptRequirements((current) => ({ ...current, amazon: { ...current.amazon, globalRequirements } }))}
            onPerImageRequirementChange={(slot, value) => setPromptRequirements((current) => ({ ...current, amazon: { ...current.amazon, perImageRequirements: { ...current.amazon.perImageRequirements, [slot]: value } } }))} /></>
      ) : (
        <CreationModeFoundationPanel mode={workspace.activeMode} workspace={workspace} setWorkspace={setWorkspace} onOpenFacts={() => setShowProductFactsAssistant(true)} factCard={factCard}
          globalRequirements={promptRequirements[workspace.activeMode].globalRequirements}
          onGlobalRequirementsChange={(globalRequirements) => {
            const mode = workspace.activeMode === 'free' ? 'free' : 'universal'
            setPromptRequirements((current) => ({ ...current, [mode]: { ...current[mode], globalRequirements } }))
            setWorkspace((current) => ({ ...current, [mode]: { ...current[mode], globalRequirements } }))
          }}
          compiledPrompt={currentGenericPrompt}
          flexiblePlan={flexiblePlans[workspace.activeMode]}
          onFlexiblePlanChange={(plan) => setFlexiblePlans((current) => ({ ...current, [workspace.activeMode]: plan }))} />
      )}
      {showProductFactsAssistant ? <ProductFactsAssistantModal profile={profile} profileError={profileError} referenceImageDataUrls={inputImages.map((image) => image.dataUrl)} showAmazonApply={false} onApplyAmazonCopy={() => undefined}
        onClose={() => { setShowProductFactsAssistant(false); setFactCard(loadFactCard()) }} onOpenApiSettings={() => { setShowProductFactsAssistant(false); setShowSettings(true, 'api') }} /> : null}
    </>
  )
}
