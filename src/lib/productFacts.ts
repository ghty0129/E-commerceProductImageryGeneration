export interface ConfirmedProductFact {
  id: string
  label: string
  value: string
  source: 'user' | 'reference-image' | 'confirmed-inference'
}

export interface ProductFactInference {
  id: string
  label: string
  value: string
  reason: string
  confirmed: boolean
}

export interface ProductFactCard {
  provisionalCategory: string
  confirmedFacts: ConfirmedProductFact[]
  inferences: ProductFactInference[]
  missingInformation: string[]
  contradictions: string[]
}

type ProductFactCardInput = {
  provisionalCategory?: unknown
  confirmedFacts?: unknown
  inferences?: unknown
  missingInformation?: unknown
  contradictions?: unknown
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function slug(value: string, fallback: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '')
  return normalized || fallback
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((item) => {
    const text = cleanText(item)
    const key = text.toLocaleLowerCase()
    if (!text || seen.has(key)) return []
    seen.add(key)
    return [text]
  })
}

export function normalizeProductFactCard(input: ProductFactCardInput | unknown): ProductFactCard {
  const source = input && typeof input === 'object' ? input as ProductFactCardInput : {}
  const factKeys = new Set<string>()
  const confirmedFacts = Array.isArray(source.confirmedFacts)
    ? source.confirmedFacts.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      const label = cleanText(record.label)
      const value = cleanText(record.value)
      const key = `${label.toLocaleLowerCase()}\u0000${value.toLocaleLowerCase()}`
      if (!label || !value || factKeys.has(key)) return []
      factKeys.add(key)
      const rawSource = cleanText(record.source)
      const factSource: ConfirmedProductFact['source'] = rawSource === 'reference-image'
        ? 'reference-image'
        : rawSource === 'confirmed-inference'
          ? 'confirmed-inference'
          : 'user'
      return [{ id: cleanText(record.id) || slug(label, `fact-${index + 1}`), label, value, source: factSource }]
    })
    : []

  const inferenceIds = new Set<string>()
  const inferences = Array.isArray(source.inferences)
    ? source.inferences.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      const label = cleanText(record.label)
      const value = cleanText(record.value)
      if (!label || !value) return []
      let id = cleanText(record.id) || slug(label, `inference-${index + 1}`)
      while (inferenceIds.has(id)) id = `${id}-${index + 1}`
      inferenceIds.add(id)
      return [{
        id,
        label,
        value,
        reason: cleanText(record.reason),
        confirmed: record.confirmed === true,
      }]
    })
    : []

  return {
    provisionalCategory: cleanText(source.provisionalCategory),
    confirmedFacts,
    inferences,
    missingInformation: normalizeStringList(source.missingInformation),
    contradictions: normalizeStringList(source.contradictions),
  }
}

export function confirmProductInference(card: ProductFactCard, inferenceId: string, confirmed = true): ProductFactCard {
  return {
    ...card,
    inferences: card.inferences.map((inference) => inference.id === inferenceId ? { ...inference, confirmed } : inference),
  }
}

export function buildConfirmedProductFactsText(card: ProductFactCard) {
  const facts = [
    ...card.confirmedFacts,
    ...card.inferences
      .filter((inference) => inference.confirmed)
      .map((inference) => ({ ...inference, source: 'confirmed-inference' as const })),
  ]
  return facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n')
}
