import type { ApiProfile } from '../types'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from './devProxy'
import { createLinkedAbortController, getApiErrorMessage } from './imageApiShared'
import { buildConfirmedProductFactsText, normalizeProductFactCard, type ProductFactCard } from './productFacts'
import { prepareReferenceImagePayload } from './referenceImagePayload'

export interface ProductCopyArtifacts {
  amazonTitle: string
  amazonBullets: string[]
  shortDescription: string
  longDescription: string
  sellingPoints: string[]
}

const ANALYSIS_INSTRUCTIONS = [
  'You are a cautious cross-border ecommerce product facts analyst.',
  'Separate facts explicitly supplied by the user or clearly visible in attached product images from guesses.',
  'Never mark inferred waterproofing, capacity, load limit, certification, package quantity, performance, compatibility, or safety claims as confirmed.',
  'All human-readable output content must be written in Simplified Chinese, including provisionalCategory, every label, value explanation, inference reason, missing-information item, and contradiction.',
  'Keep brand names, model numbers, SKUs, numbers, dimensions, units, and other product data exactly as supplied; do not translate, convert, round, or rewrite them.',
  'Use concise Chinese ecommerce terminology. Do not output English sentences unless the source text is a brand, model, SKU, technical standard, or other proper name that must remain unchanged.',
  'Return JSON only with provisionalCategory, confirmedFacts, inferences, missingInformation, and contradictions.',
  'Keep the JSON property names and source enum values in English exactly as specified, while writing their displayed content in Simplified Chinese.',
  'Each confirmedFacts item has label, value, and source (user or reference-image).',
  'Each inferences item has a stable id, label, value, and reason. Inferences require later user confirmation.',
].join('\n')

const COPY_INSTRUCTIONS = [
  'You are a cross-border ecommerce copywriter.',
  'Use only the confirmed product facts supplied in the user message.',
  'Do not add claims, specifications, certifications, quantities, compatibility, performance, or benefits that are not supported by those facts.',
  'Return JSON only with amazonTitle, amazonBullets, shortDescription, longDescription, and sellingPoints.',
  'amazonBullets must contain exactly five useful bullets. Reframe and organize the confirmed facts into five distinct customer-facing points without adding any unsupported claim.',
].join('\n')

function extractText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>
  if (typeof record.output_text === 'string') return record.output_text
  const choices = Array.isArray(record.choices) ? record.choices : []
  const message = choices[0] && typeof choices[0] === 'object'
    ? (choices[0] as Record<string, unknown>).message
    : null
  if (message && typeof message === 'object' && typeof (message as Record<string, unknown>).content === 'string') {
    return (message as Record<string, unknown>).content as string
  }
  const output = Array.isArray(record.output) ? record.output : []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : []
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string') {
        return (part as Record<string, unknown>).text as string
      }
    }
  }
  return ''
}

function parseJsonText(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  return JSON.parse(fenced ?? trimmed) as unknown
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : []
}

function normalizeProductCopy(value: unknown): ProductCopyArtifacts {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    amazonTitle: cleanText(record.amazonTitle),
    amazonBullets: cleanList(record.amazonBullets).slice(0, 5),
    shortDescription: cleanText(record.shortDescription),
    longDescription: cleanText(record.longDescription),
    sellingPoints: cleanList(record.sellingPoints),
  }
}

async function callStructuredTextApi(options: {
  profile: ApiProfile
  instructions: string
  userText: string
  referenceImageDataUrls?: string[]
  signal?: AbortSignal
}) {
  const { profile, instructions, userText, referenceImageDataUrls = [], signal } = options
  const request = createLinkedAbortController(profile.timeout, signal)
  const proxyConfig = readClientDevProxyConfig()
  const useProxy = shouldUseApiProxy(profile.apiProxy, proxyConfig, profile.baseUrl)
  const isChat = profile.apiMode === 'chat'
  const content = referenceImageDataUrls.length
    ? [
      { type: 'text', text: userText },
      ...referenceImageDataUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
    ]
    : userText
  const body = isChat
    ? {
      model: profile.model,
      messages: [{ role: 'system', content: instructions }, { role: 'user', content }],
      response_format: { type: 'json_object' },
      stream: false,
    }
    : {
      model: profile.model,
      instructions,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: userText },
          ...referenceImageDataUrls.map((url) => ({ type: 'input_image', image_url: url })),
        ],
      }],
      text: { format: { type: 'json_object' } },
      stream: false,
    }
  try {
    const response = await fetch(
      buildApiUrl(profile.baseUrl, isChat ? 'chat/completions' : 'responses', proxyConfig, useProxy, { prefixV1: !isChat }),
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${profile.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: request.controller.signal,
      },
    )
    if (!response.ok) throw new Error(await getApiErrorMessage(response))
    const text = extractText(await response.json())
    if (!text) throw new Error('商品资料助手未返回可解析的内容')
    return parseJsonText(text)
  } finally {
    request.cleanup()
  }
}

export async function callProductFactsAnalysisApi(options: {
  profile: ApiProfile
  description: string
  referenceImageDataUrls?: string[]
  signal?: AbortSignal
}) {
  const references = await prepareReferenceImagePayload(options.referenceImageDataUrls ?? [], { signal: options.signal })
  const payload = await callStructuredTextApi({
    ...options,
    referenceImageDataUrls: references.dataUrls,
    instructions: ANALYSIS_INSTRUCTIONS,
    userText: `请分析以下可能不完整的商品资料。只把用户明确提供或参考图清晰可见的信息列为事实，不要补造缺失信息。分析结果的所有可读内容统一使用简体中文；品牌、型号、SKU、数字、尺寸和单位保持原样。\n\n${options.description.trim()}`,
  })
  return normalizeProductFactCard(payload, { preserveInferenceConfirmation: false })
}

export async function callProductCopyApi(options: {
  profile: ApiProfile
  card: ProductFactCard
  language: string
  signal?: AbortSignal
}) {
  const facts = buildConfirmedProductFactsText(options.card)
  if (!facts) throw new Error('请先确认至少一条商品事实')
  const payload = await callStructuredTextApi({
    profile: options.profile,
    instructions: COPY_INSTRUCTIONS,
    userText: `Output language: ${options.language.trim() || 'US English'}\n\nConfirmed product facts:\n${facts}`,
    signal: options.signal,
  })
  const copy = normalizeProductCopy(payload)
  if (copy.amazonBullets.length !== 5) {
    throw new Error('AI未能生成完整五点描述，请补充商品事实后重试')
  }
  return copy
}

export async function callPromptEnglishTranslationApi(options: {
  profile: ApiProfile
  chinesePrompt: string
  signal?: AbortSignal
}) {
  const payload = await callStructuredTextApi({
    profile: options.profile,
    instructions: [
      'You are a precise ecommerce image-generation prompt translator.',
      'Translate the complete Chinese review prompt into natural, unambiguous English for an image-generation model.',
      'Preserve every heading, priority, requirement, negative constraint, and distinction between images.',
      'Keep brand names, model numbers, SKUs, numbers, dimensions, units, quoted on-image copy, Logo, and watermark requirements exact.',
      'Do not add, remove, soften, summarize, or reinterpret any instruction.',
      'Return JSON only with one string property: englishPrompt.',
    ].join('\n'),
    userText: options.chinesePrompt,
    signal: options.signal,
  })
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const englishPrompt = cleanText(record.englishPrompt)
  if (!englishPrompt) throw new Error('AI 未返回可用的英文生图提示词')
  return englishPrompt
}
