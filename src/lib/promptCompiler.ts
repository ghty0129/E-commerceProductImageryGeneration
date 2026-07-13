import { getCreationModePolicy, type CreationMode } from './creationModes'

export type PromptSectionKind =
  | 'mode-rules'
  | 'global-requirements'
  | 'per-image-requirements'
  | 'product-facts'
  | 'image-goal'
  | 'composition-copy'
  | 'visual-style'
  | 'series-consistency'
  | 'technical'
  | 'negative'

export interface PromptSection {
  kind: PromptSectionKind
  label: string
  source: string
  priority: number
  content: string
}

export interface PromptDiagnostic {
  code: string
  severity: 'blocker' | 'warning' | 'info'
  title: string
  message: string
  conflictingRuleId?: string
}

export interface PromptCompilerInput {
  mode: CreationMode
  amazonSlot?: string | null
  globalRequirements?: string
  perImageRequirements?: string
  confirmedProductFacts?: string
  imageGoal?: string
  compositionAndCopy?: string
  visualStyle?: string
  seriesConsistency?: string
  technicalRequirements?: string
  negativePrompt?: string
}

export interface CompiledImagePrompt {
  sections: PromptSection[]
  finalPrompt: string
  diagnostics: PromptDiagnostic[]
  canSubmit: boolean
}

const WATERMARK_PATTERN = /(?:watermark|水印)/i
const OWNED_ASSET_PATTERN = /(?:watermark|logo|brand mark|水印|标志|徽标|品牌标识)/i
const AMAZON_PRICE_PATTERN = /(?:price|pricing|discount|coupon|sale price|\d+(?:\.\d+)?\s*%\s*off|[$€£¥￥]\s*\d+(?:\.\d+)?|价格|售价|到手价|折扣|优惠券|促销价)/i
const AMAZON_RATING_PATTERN = /(?:five[- ]star|5[- ]star|\d(?:\.\d+)?\s*stars?|rating|review badge|best seller|amazon choice|五星|\d(?:\.\d+)?\s*星|评分|评论徽章|畅销|亚马逊之选)/i
const PERSON_REQUIREMENT_PATTERN = /(?:include|show|with|添加|展示|出现).{0,16}(?:person|people|man|woman|model|人物|人像|男性|女性|模特)/i
const PERSON_NEGATIVE_PATTERN = /(?:no|without|exclude|禁止|不要|无人).{0,12}(?:person|people|human|man|woman|人物|人像|人类|男性|女性)/i

function clean(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function combinedRequirements(input: PromptCompilerInput) {
  return [input.globalRequirements, input.perImageRequirements].map(clean).filter(Boolean).join('\n')
}

export function diagnosePromptConflicts(input: PromptCompilerInput): PromptDiagnostic[] {
  const requirements = combinedRequirements(input)
  const diagnostics: PromptDiagnostic[] = []

  if (input.mode === 'amazon' && WATERMARK_PATTERN.test(requirements)) {
    diagnostics.push({
      code: 'amazon-watermark', severity: 'blocker', title: '水印与 Amazon 规则冲突',
      message: 'Amazon 模式不允许把水印写入最终生图要求。请删除该要求，或切换到平台通用/自由创作模式。',
      conflictingRuleId: 'amazon-main-no-watermark',
    })
  }
  if (input.mode === 'amazon' && AMAZON_PRICE_PATTERN.test(requirements)) {
    diagnostics.push({
      code: 'amazon-price-promotion', severity: 'blocker', title: '价格或促销内容与 Amazon 规则冲突',
      message: 'Amazon 生图要求中不能加入价格、折扣、优惠券或促销价。',
      conflictingRuleId: 'amazon-fixed-workflow',
    })
  }
  if (input.mode === 'amazon' && AMAZON_RATING_PATTERN.test(requirements)) {
    diagnostics.push({
      code: 'amazon-rating-badge', severity: 'blocker', title: '评分或平台徽章与 Amazon 规则冲突',
      message: 'Amazon 生图要求中不能加入评分、评论徽章、Best Seller 或 Amazon Choice 等元素。',
      conflictingRuleId: 'amazon-fixed-workflow',
    })
  }
  if (input.mode !== 'amazon' && OWNED_ASSET_PATTERN.test(requirements)) {
    diagnostics.push({
      code: 'owned-asset-rights', severity: 'info', title: '请确认素材使用权',
      message: 'Logo、水印和品牌标识应当由你拥有或已获得授权。',
      conflictingRuleId: 'owned-assets-only',
    })
  }
  if (PERSON_REQUIREMENT_PATTERN.test(requirements) && PERSON_NEGATIVE_PATTERN.test(clean(input.negativePrompt))) {
    diagnostics.push({
      code: 'requirement-negative-conflict', severity: 'warning', title: '人物要求与 Negative Prompt 冲突',
      message: '用户要求包含人物，但 Negative Prompt 同时排除了人物。最终提示词会保留用户要求，请检查 Negative Prompt。',
    })
  }

  return diagnostics
}

function createSection(kind: PromptSectionKind, label: string, source: string, priority: number, content: string): PromptSection | null {
  const normalized = clean(content)
  return normalized ? { kind, label, source, priority, content: normalized } : null
}

export function compileImagePrompt(input: PromptCompilerInput): CompiledImagePrompt {
  const policy = getCreationModePolicy(input.mode)
  const modeRules = [`Selected creation mode: ${policy.label}.`, ...policy.rules.map((rule) => `- ${rule.label}: ${rule.detail}`)].join('\n')
  const diagnostics = diagnosePromptConflicts(input)
  const userPriorityNotice = 'User requirements override conflicting default visual style guidance, series styling, and negative-prompt preferences, but never override mode hard rules or confirmed product facts.'
  const productTruthNotice = 'Treat every confirmed product fact as authoritative. Do not change, contradict, or visually reinterpret these facts.'
  const lowerPriorityNotice = 'Apply this default guidance only where it does not conflict with higher-priority mode rules, user requirements, or confirmed product facts.'

  const candidates = [
    createSection('mode-rules', 'Safety and selected-mode rules', `${policy.label} 模式规则`, 1, modeRules),
    createSection('global-requirements', 'User global requirements', '当前项目', 2, clean(input.globalRequirements) ? `${userPriorityNotice}\n${clean(input.globalRequirements)}` : ''),
    createSection('per-image-requirements', 'User per-image requirements', input.amazonSlot ? `图片位 ${input.amazonSlot}` : '当前图片', 3, clean(input.perImageRequirements) ? `${userPriorityNotice}\n${clean(input.perImageRequirements)}` : ''),
    createSection('product-facts', 'Confirmed product facts', '已审核商品事实卡', 4, clean(input.confirmedProductFacts) ? `${productTruthNotice}\n${clean(input.confirmedProductFacts)}` : ''),
    createSection('image-goal', 'Image goal and plan', input.amazonSlot ? `${input.amazonSlot} 的 AI 策划` : '当前图片策划', 5, clean(input.imageGoal)),
    createSection('composition-copy', 'Composition and on-image copy', '当前图片策划', 6, clean(input.compositionAndCopy)),
    createSection('visual-style', 'Selected visual style', '视觉风格选择', 7, clean(input.visualStyle) ? `${lowerPriorityNotice}\n${clean(input.visualStyle)}` : ''),
    createSection('series-consistency', 'Series consistency', '当前套图', 8, clean(input.seriesConsistency) ? `${lowerPriorityNotice}\n${clean(input.seriesConsistency)}` : ''),
    createSection('technical', 'Technical output requirements', '当前生成设置', 9, clean(input.technicalRequirements)),
    createSection('negative', 'Negative prompt', '当前图片策划', 10, clean(input.negativePrompt) ? `${lowerPriorityNotice}\n${clean(input.negativePrompt)}` : ''),
  ]
  const sections = candidates.filter((section): section is PromptSection => section !== null)
  const finalPrompt = sections.map((section) => [
    `## ${section.label}`,
    `Source: ${section.source}. Priority: ${section.priority}.`,
    section.kind === 'negative' && diagnostics.some((item) => item.code === 'requirement-negative-conflict')
      ? `Apply this section only where it does not conflict with higher-priority user requirements.\n${section.content}`
      : section.content,
  ].join('\n')).join('\n\n')

  return { sections, finalPrompt, diagnostics, canSubmit: diagnostics.every((item) => item.severity !== 'blocker') }
}
