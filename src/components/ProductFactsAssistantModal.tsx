import { useEffect, useState } from 'react'
import type { ApiProfile } from '../types'
import { isOfficialDeepSeekPlannerProfile } from '../lib/apiProfiles'
import { confirmProductInference } from '../lib/productFacts'
import { callProductCopyApi, callProductFactsAnalysisApi } from '../lib/productFactsApi'
import {
  createEmptyProductFactsWorkspace,
  formatAmazonListingCopy,
  loadProductFactsWorkspace,
  replaceWorkspaceFactCard,
  saveProductFactsWorkspace,
  type ProductFactsWorkspace,
} from '../lib/productFactsWorkspace'
import { copyTextToClipboard } from '../lib/clipboard'
import { CloseIcon, CopyIcon } from './icons'

interface ProductFactsAssistantModalProps {
  profile: ApiProfile | null
  profileError: string | null
  referenceImageDataUrls: string[]
  onApplyAmazonCopy: (listingText: string) => void
  onClose: () => void
  onOpenApiSettings: () => void
}

const FIELD_CLASS = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

function loadInitialWorkspace() {
  return typeof window === 'undefined' ? createEmptyProductFactsWorkspace() : loadProductFactsWorkspace(window.localStorage)
}

export default function ProductFactsAssistantModal({
  profile,
  profileError,
  referenceImageDataUrls,
  onApplyAmazonCopy,
  onClose,
  onOpenApiSettings,
}: ProductFactsAssistantModalProps) {
  const [workspace, setWorkspace] = useState<ProductFactsWorkspace>(loadInitialWorkspace)
  const [busy, setBusy] = useState<'analysis' | 'copy' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    saveProductFactsWorkspace(window.localStorage, workspace)
  }, [workspace])

  const analyze = async () => {
    if (!profile || profileError) {
      setError(profileError || '请先配置AI策划接口')
      return
    }
    if (!workspace.description.trim()) {
      setError('请先描述产品已知信息')
      return
    }
    setBusy('analysis')
    setError('')
    try {
      const card = await callProductFactsAnalysisApi({
        profile,
        description: workspace.description,
        referenceImageDataUrls: isOfficialDeepSeekPlannerProfile(profile) ? [] : referenceImageDataUrls,
      })
      setWorkspace((current) => replaceWorkspaceFactCard(current, card))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  const generateCopy = async () => {
    if (!profile || profileError) {
      setError(profileError || '请先配置AI策划接口')
      return
    }
    setBusy('copy')
    setError('')
    try {
      const copy = await callProductCopyApi({ profile, card: workspace.card, language: workspace.language })
      setWorkspace((current) => ({ ...current, copy }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  const amazonListingCopy = formatAmazonListingCopy(workspace.copy)
  const copyArtifacts = [
    ['Amazon标题', workspace.copy.amazonTitle],
    ['Amazon五点', workspace.copy.amazonBullets.map((item) => `- ${item}`).join('\n')],
    ['通用简短描述', workspace.copy.shortDescription],
    ['通用详细描述', workspace.copy.longDescription],
    ['通用卖点', workspace.copy.sellingPoints.map((item) => `- ${item}`).join('\n')],
  ] as const

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="商品资料助手">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-2xl dark:border-white/[0.1] dark:bg-gray-950">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-4 py-4 dark:border-white/[0.08] dark:bg-gray-900 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">商品资料助手</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">先把零散资料整理成事实卡，再生成标题、五点和通用描述。AI推测不会自动作为商品事实。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/[0.08]" aria-label="关闭">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2">
          <div className="border-b border-gray-200 p-4 dark:border-white/[0.08] lg:border-b-0 lg:border-r sm:p-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">我对产品的描述</span>
              <textarea
                value={workspace.description}
                onChange={(event) => setWorkspace((current) => ({ ...current, description: event.target.value }))}
                className={`${FIELD_CLASS} min-h-44 resize-y`}
                placeholder="例：黑色可折叠旅行收纳袋，已知是涤纶材质，展开尺寸45×32×16cm。用于旅行收纳，但容量、承重、防水等级和包装数量都不确定，请不要猜测。"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void analyze()} disabled={Boolean(busy)} className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:bg-gray-400">
                {busy === 'analysis' ? '分析中…' : '整理商品事实'}
              </button>
              <span className="text-xs text-gray-500">将读取当前已上传的 {referenceImageDataUrls.length} 张商品参考图</span>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">商品事实卡</h3>
                {workspace.card.provisionalCategory && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">暂定：{workspace.card.provisionalCategory}</span>}
              </div>
              <div className="mt-3 space-y-4 text-sm">
                <section>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">已确认事实</div>
                  {workspace.card.confirmedFacts.length ? (
                    <ul className="mt-1 space-y-1 text-gray-700 dark:text-gray-200">
                      {workspace.card.confirmedFacts.map((fact) => <li key={fact.id}>• {fact.label}：{fact.value}</li>)}
                    </ul>
                  ) : <p className="mt-1 text-xs text-gray-400">分析后显示用户提供或参考图明确支持的事实。</p>}
                </section>
                <section>
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">待确认推测</div>
                  {workspace.card.inferences.length ? (
                    <div className="mt-2 space-y-2">
                      {workspace.card.inferences.map((inference) => (
                        <label key={inference.id} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-400/20 dark:bg-amber-400/10">
                          <input type="checkbox" checked={inference.confirmed} onChange={(event) => setWorkspace((current) => replaceWorkspaceFactCard(current, confirmProductInference(current.card, inference.id, event.target.checked)))} className="mt-0.5" />
                          <span><strong>{inference.label}：</strong>{inference.value}{inference.reason ? <small className="mt-0.5 block text-amber-700/80 dark:text-amber-200/70">依据：{inference.reason}</small> : null}</span>
                        </label>
                      ))}
                    </div>
                  ) : <p className="mt-1 text-xs text-gray-400">没有待确认推测。</p>}
                </section>
                {workspace.card.missingInformation.length ? <section><div className="text-xs font-semibold text-gray-600 dark:text-gray-300">缺失信息</div><p className="mt-1 text-gray-600 dark:text-gray-300">{workspace.card.missingInformation.join('、')}</p></section> : null}
                {workspace.card.contradictions.length ? <section><div className="text-xs font-semibold text-red-600 dark:text-red-300">矛盾信息</div><ul className="mt-1 space-y-1 text-red-700 dark:text-red-200">{workspace.card.contradictions.map((item) => <li key={item}>• {item}</li>)}</ul></section> : null}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1"><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">输出语言</span><input value={workspace.language} onChange={(event) => setWorkspace((current) => ({ ...current, language: event.target.value }))} className={FIELD_CLASS} /></label>
              <button type="button" onClick={() => void generateCopy()} disabled={Boolean(busy)} className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-wait disabled:bg-gray-400 dark:bg-white dark:text-gray-950">
                {busy === 'copy' ? '生成中…' : '生成商品文案'}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {copyArtifacts.map(([label, value]) => (
                <section key={label} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-gray-900">
                  <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold text-gray-700 dark:text-gray-200">{label}</h3><button type="button" disabled={!value} onClick={() => void copyTextToClipboard(value)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 disabled:text-gray-300 dark:text-blue-300"><CopyIcon className="h-3.5 w-3.5" />复制</button></div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">{value || '尚未生成'}</div>
                </section>
              ))}
            </div>
          </div>
        </div>

        {error ? <div className="border-t border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{error}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-gray-900 sm:px-5">
          <div className="flex gap-2">
            <button type="button" onClick={() => setWorkspace(createEmptyProductFactsWorkspace())} className="h-9 rounded-lg px-3 text-sm font-medium text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/[0.08]">清空</button>
            {profileError ? <button type="button" onClick={onOpenApiSettings} className="h-9 rounded-lg px-3 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300">配置AI接口</button> : null}
          </div>
          <button type="button" disabled={!amazonListingCopy} onClick={() => { onApplyAmazonCopy(amazonListingCopy); onClose() }} className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-300">回填到Amazon策划</button>
        </div>
      </div>
    </div>
  )
}
