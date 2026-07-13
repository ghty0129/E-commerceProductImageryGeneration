import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiProfile } from '../types'
import { callProductCopyApi, callProductFactsAnalysisApi } from './productFactsApi'
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

    expect(card.confirmedFacts[0]?.value).toBe('Polyester')
    expect(card.inferences[0]).toMatchObject({ id: 'waterproof', confirmed: false })
  })

  it('sends only confirmed facts when generating product copy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        amazonTitle: 'Foldable Polyester Travel Bag',
        amazonBullets: ['Folds for storage'],
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
  })
})
