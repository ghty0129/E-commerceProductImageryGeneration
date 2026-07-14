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

export function normalizeProductFactCard(
  input: ProductFactCardInput | unknown,
  options: { preserveInferenceConfirmation?: boolean } = {},
): ProductFactCard {
  const source = input && typeof input === 'object' ? input as ProductFactCardInput : {}
  const factKeys = new Set<string>()
  const factIds = new Set<string>()
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
      let id = cleanText(record.id) || slug(label, `fact-${index + 1}`)
      while (factIds.has(id)) id = `${id}-${index + 1}`
      factIds.add(id)
      return [{ id, label, value, source: factSource }]
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
        confirmed: options.preserveInferenceConfirmation !== false && record.confirmed === true,
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

export function productFactDecisionKey(fact: { label: string; value: string }) {
  return `${cleanText(fact.label).toLocaleLowerCase()}\u0000${cleanText(fact.value).toLocaleLowerCase()}`
}

export function promoteProductInferences(card: ProductFactCard, inferenceIds: Iterable<string>): ProductFactCard {
  const selected = new Set(inferenceIds)
  if (!selected.size) return card
  const promoted = card.inferences
    .filter((inference) => selected.has(inference.id))
    .map((inference) => ({
      id: inference.id,
      label: inference.label,
      value: inference.value,
      source: 'confirmed-inference' as const,
    }))
  const existing = new Set(card.confirmedFacts.map(productFactDecisionKey))
  return {
    ...card,
    confirmedFacts: [...card.confirmedFacts, ...promoted.filter((fact) => !existing.has(productFactDecisionKey(fact)))],
    inferences: card.inferences.filter((inference) => !selected.has(inference.id)),
  }
}

export function mergeProductFactAnalysis(
  previous: ProductFactCard,
  incoming: ProductFactCard,
  rejectedFactKeys: Iterable<string> = [],
): ProductFactCard {
  const rejected = new Set(rejectedFactKeys)
  const confirmed = previous.confirmedFacts.filter((fact) => !rejected.has(productFactDecisionKey(fact)))
  const confirmedKeys = new Set(confirmed.map(productFactDecisionKey))
  for (const fact of incoming.confirmedFacts) {
    const key = productFactDecisionKey(fact)
    if (!rejected.has(key) && !confirmedKeys.has(key)) {
      confirmed.push(fact)
      confirmedKeys.add(key)
    }
  }
  return {
    ...incoming,
    confirmedFacts: confirmed,
    inferences: incoming.inferences.filter((inference) => {
      const key = productFactDecisionKey(inference)
      return !rejected.has(key) && !confirmedKeys.has(key)
    }),
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
