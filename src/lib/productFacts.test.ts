import { describe, expect, it } from 'vitest'
import {
  buildConfirmedProductFactsText,
  confirmProductInference,
  normalizeProductFactCard,
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
})
