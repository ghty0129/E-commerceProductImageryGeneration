import type { CompiledImagePrompt } from '../lib/promptCompiler'

const DIAGNOSTIC_STYLE = {
  blocker: 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200',
} as const

const DIAGNOSTIC_LABEL = { blocker: '阻止生成', warning: '需要检查', info: '使用提醒' } as const

export default function PromptStructurePreview({ compiled, chineseReview }: { compiled: CompiledImagePrompt; chineseReview?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-gray-900 dark:text-white">提示词结构</div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${compiled.canSubmit ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200'}`}>
          {compiled.canSubmit ? '可以生成' : '存在阻止项'}
        </span>
      </div>

      {compiled.diagnostics.length > 0 && (
        <div className="mt-3 space-y-2">
          {compiled.diagnostics.map((diagnostic) => (
            <div key={diagnostic.code} className={`rounded-lg border px-3 py-2 text-xs ${DIAGNOSTIC_STYLE[diagnostic.severity]}`}>
              <div className="font-bold">{DIAGNOSTIC_LABEL[diagnostic.severity]} · {diagnostic.title}</div>
              <div className="mt-1 leading-relaxed opacity-90">{diagnostic.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {compiled.sections.map((section) => (
          <div key={section.kind} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-gray-800 dark:text-gray-100">{section.label}</span>
              <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-white/[0.08] dark:text-blue-200">优先级 {section.priority}</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">来源：{section.source}</div>
            <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{section.content}</div>
          </div>
        ))}
      </div>
      {chineseReview ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-400/20 dark:bg-blue-400/10">
          <div className="text-xs font-bold text-blue-800 dark:text-blue-200">中文提示词预览（审核用）</div>
          <div className="mt-1 text-[11px] text-blue-700/70 dark:text-blue-200/70">确认内容无误后，点击“生成英文并填入生图栏”。</div>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-sans text-xs leading-relaxed text-gray-700 dark:bg-gray-950 dark:text-gray-200">{chineseReview}</pre>
        </div>
      ) : null}
    </div>
  )
}
