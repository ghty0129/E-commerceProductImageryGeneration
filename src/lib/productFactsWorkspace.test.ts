import { describe, expect, it } from 'vitest'
import { createEmptyProductFactsWorkspace, formatAmazonListingCopy, loadProductFactsWorkspace, replaceWorkspaceFactCard, saveProductFactsWorkspace } from './productFactsWorkspace'
import { normalizeProductFactCard } from './productFacts'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('product facts workspace', () => {
  it('restores the product description, fact card, and generated copy', () => {
    const storage = new MemoryStorage()
    const workspace = createEmptyProductFactsWorkspace()
    workspace.description = 'Black foldable polyester travel bag.'
    workspace.card.confirmedFacts = [{ id: 'material', label: 'Material', value: 'Polyester', source: 'user' }]
    workspace.copy.amazonTitle = 'Foldable Polyester Travel Bag'

    saveProductFactsWorkspace(storage, workspace)

    expect(loadProductFactsWorkspace(storage)).toEqual(workspace)
  })

  it('formats generated title and bullets for the existing Amazon planner input', () => {
    const listing = formatAmazonListingCopy({
      amazonTitle: 'Foldable Polyester Travel Bag',
      amazonBullets: ['Folds flat for storage', 'Black polyester construction'],
      shortDescription: '',
      longDescription: '',
      sellingPoints: [],
    })

    expect(listing).toBe('Title: Foldable Polyester Travel Bag\n\nAbout this item\n- Folds flat for storage\n- Black polyester construction')
  })

  it('invalidates generated copy whenever the supporting fact card changes', () => {
    const workspace = createEmptyProductFactsWorkspace()
    workspace.copy.amazonTitle = 'Outdated title'

    const updated = replaceWorkspaceFactCard(workspace, normalizeProductFactCard({
      confirmedFacts: [{ label: 'Material', value: 'Polyester' }],
    }))

    expect(updated.copy.amazonTitle).toBe('')
    expect(updated.card.confirmedFacts[0]?.value).toBe('Polyester')
  })
})
