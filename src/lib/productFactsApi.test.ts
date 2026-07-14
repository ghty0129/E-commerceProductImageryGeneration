import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiProfile } from '../types'
import { callProductCopyApi, callProductFactsAnalysisApi, callPromptEnglishTranslationApi } from './productFactsApi'
import { normalizeProductFactCard } from './productFacts'

const profile: ApiProfile = {
  id: 'planner',
  name: 'Planner',
  provider: 'openai',
  apiMode: 'chat',
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'secret',
  model: 'text-model',
  timeout: 60,
  apiProxy: false,
  streamImages: false,
  streamPartialImages: 0,
  codexCli: false,
}

afterEach(() => vi.unstubAllGlobals())

describe('product facts assistant API', () => {
  it('normalizes structured analysis returned by the planner profile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        provisionalCategory: 'Foldable travel bag',
        confirmedFacts: [{ label: 'Material', value: 'Polyester', source: 'user' }],
        inferences: [{ id: 'waterproof', label: 'Waterproof', value: 'Yes', reason: 'Material guess' }],
        missingInformation: ['Capacity'],
        contradictions: [],
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const card = await callProductFactsAnalysisApi({ profile, description: 'Polyester foldable travel bag.' })
    const request = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body))

    expect(card.confirmedFacts[0]?.value).toBe('Polyester')
    expect(card.inferences[0]).toMatchObject({ id: 'waterproof', confirmed: false })
    expect(request.messages[0].content).toContain('Simplified Chinese')
    expect(request.messages[1].content).toContain('统一使用简体中文')
  })

  it('sends only confirmed facts when generating product copy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        amazonTitle: 'Foldable Polyester Travel Bag',
        amazonBullets: ['Polyester material', 'Black color', 'Foldable construction', 'Travel use', 'Compact storage'],
        shortDescription: 'A foldable polyester bag for travel organization.',
        longDescription: 'Organize travel essentials with a foldable polyester bag.',
        sellingPoints: ['Polyester material', 'Foldable design'],
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const card = normalizeProductFactCard({
      confirmedFacts: [{ label: 'Material', value: 'Polyester', source: 'user' }],
      inferences: [{ id: 'waterproof', label: 'Waterproof', value: 'Yes', reason: 'Material guess' }],
    })

    const copy = await callProductCopyApi({ profile, card, language: 'US English' })
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const userText = request.messages[1].content as string

    expect(userText).toContain('Material: Polyester')
    expect(userText).not.toContain('Waterproof')
    expect(copy.amazonTitle).toBe('Foldable Polyester Travel Bag')
    expect(copy.amazonBullets).toHaveLength(5)
  })

  it('translates the reviewed prompt to English without changing protected product data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ englishPrompt: 'Use model AB-12 at 45 × 32 cm. Add the owned Logo.' }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await callPromptEnglishTranslationApi({ profile, chinesePrompt: '使用型号 AB-12，尺寸 45 × 32 cm，加入自有 Logo。' })
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))

    expect(result).toContain('AB-12')
    expect(result).toContain('45 × 32 cm')
    expect(request.messages[0].content).toContain('Do not add, remove, soften, summarize')
  })
})
