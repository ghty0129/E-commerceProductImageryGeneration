import { describe, expect, it } from 'vitest'
import {
  buildConfirmedProductFactsText,
  confirmProductInference,
  mergeProductFactAnalysis,
  normalizeProductFactCard,
  productFactDecisionKey,
  promoteProductInferences,
  type ProductFactCard,
} from './productFacts'

describe('product fact card', () => {
  it('keeps AI inferences separate from confirmed product facts', () => {
    const card = normalizeProductFactCard({
      provisionalCategory: 'foldable travel bag',
      confirmedFacts: [
        { label: 'Material', value: 'Polyester', source: 'user' },
        { label: 'Color', value: 'Black', source: 'user' },
      ],
      inferences: [
        { id: 'water-resistant', label: 'Water resistance', value: 'Water-resistant', reason: 'Polyester is sometimes treated for water resistance' },
      ],
      missingInformation: ['Capacity', 'Load limit', 'Package quantity'],
      contradictions: [],
    })

    expect(buildConfirmedProductFactsText(card)).toContain('Material: Polyester')
    expect(buildConfirmedProductFactsText(card)).not.toContain('Water-resistant')
    expect(card.inferences[0]?.confirmed).toBe(false)
  })

  it('promotes an inference only after explicit confirmation', () => {
    const card: ProductFactCard = normalizeProductFactCard({
      provisionalCategory: 'foldable travel bag',
      confirmedFacts: [],
      inferences: [
        { id: 'travel-use', label: 'Intended use', value: 'Travel organization', reason: 'The user described travel use' },
      ],
      missingInformation: [],
      contradictions: [],
    })

    const confirmed = confirmProductInference(card, 'travel-use')

    expect(confirmed.inferences[0]?.confirmed).toBe(true)
    expect(buildConfirmedProductFactsText(confirmed)).toContain('Intended use: Travel organization')
  })

  it('moves explicitly selected inferences into confirmed facts', () => {
    const card = normalizeProductFactCard({
      confirmedFacts: [],
      inferences: [
        { id: 'color', label: '颜色', value: '黑色' },
        { id: 'capacity', label: '容量', value: '30 L' },
      ],
    })

    const promoted = promoteProductInferences(card, ['color'])

    expect(promoted.confirmedFacts).toContainEqual(expect.objectContaining({ label: '颜色', value: '黑色', source: 'confirmed-inference' }))
    expect(promoted.inferences.map((item) => item.id)).toEqual(['capacity'])
  })

  it('keeps confirmed decisions and suppresses rejected facts after re-analysis', () => {
    const previous = normalizeProductFactCard({
      confirmedFacts: [{ id: 'color', label: '颜色', value: '黑色', source: 'confirmed-inference' }],
    })
    const incoming = normalizeProductFactCard({
      confirmedFacts: [{ id: 'material', label: '材质', value: '涤纶', source: 'user' }],
      inferences: [
        { id: 'color-again', label: '颜色', value: '黑色' },
        { id: 'waterproof', label: '防水性', value: '防水' },
      ],
    })

    const merged = mergeProductFactAnalysis(previous, incoming, [productFactDecisionKey({ label: '防水性', value: '防水' })])

    expect(merged.confirmedFacts.map((fact) => fact.label)).toEqual(['颜色', '材质'])
    expect(merged.inferences).toEqual([])
  })

  it('deduplicates and discards incomplete AI output', () => {
    const card = normalizeProductFactCard({
      provisionalCategory: '  Travel bag  ',
      confirmedFacts: [
        { label: 'Material', value: 'Polyester', source: 'user' },
        { label: ' material ', value: 'Polyester', source: 'ai' },
        { label: '', value: 'ignored', source: 'ai' },
      ],
      inferences: [],
      missingInformation: ['Capacity', ' capacity ', ''],
      contradictions: [],
    })

    expect(card.provisionalCategory).toBe('Travel bag')
    expect(card.confirmedFacts).toHaveLength(1)
    expect(card.missingInformation).toEqual(['Capacity'])
  })

  it('can force every AI-provided inference back to unconfirmed', () => {
    const card = normalizeProductFactCard({
      inferences: [{ id: 'capacity', label: 'Capacity', value: '30 L', confirmed: true }],
    }, { preserveInferenceConfirmation: false })

    expect(card.inferences[0]?.confirmed).toBe(false)
  })

  it('assigns unique ids to confirmed facts with the same label', () => {
    const card = normalizeProductFactCard({
      confirmedFacts: [
        { label: 'Dimensions', value: 'Folded: 20 × 15 cm' },
        { label: 'Dimensions', value: 'Expanded: 45 × 32 × 16 cm' },
      ],
    })

    expect(new Set(card.confirmedFacts.map((fact) => fact.id)).size).toBe(2)
  })
})
