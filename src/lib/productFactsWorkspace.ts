import { mergeProductFactAnalysis, normalizeProductFactCard, productFactDecisionKey, promoteProductInferences, type ProductFactCard } from './productFacts'
import type { ProductCopyArtifacts } from './productFactsApi'

const STORAGE_KEY = 'amazon-image-studio-product-facts-workspace-v1'

export interface ProductFactsWorkspace {
  description: string
  language: string
  card: ProductFactCard
  rejectedFactKeys: string[]
  copy: ProductCopyArtifacts
}

const EMPTY_COPY: ProductCopyArtifacts = {
  amazonTitle: '',
  amazonBullets: [],
  shortDescription: '',
  longDescription: '',
  sellingPoints: [],
}

function createEmptyCopy(): ProductCopyArtifacts {
  return { ...EMPTY_COPY, amazonBullets: [], sellingPoints: [] }
}

export function createEmptyProductFactsWorkspace(): ProductFactsWorkspace {
  return {
    description: '',
    language: 'US English',
    card: normalizeProductFactCard({}),
    rejectedFactKeys: [],
    copy: createEmptyCopy(),
  }
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function loadProductFactsWorkspace(storage: Pick<Storage, 'getItem'>): ProductFactsWorkspace {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyProductFactsWorkspace()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const copy = parsed.copy && typeof parsed.copy === 'object' ? parsed.copy as Record<string, unknown> : {}
    return {
      description: cleanText(parsed.description),
      language: cleanText(parsed.language) || 'US English',
      card: normalizeProductFactCard(parsed.card),
      rejectedFactKeys: cleanList(parsed.rejectedFactKeys),
      copy: {
        amazonTitle: cleanText(copy.amazonTitle),
        amazonBullets: cleanList(copy.amazonBullets),
        shortDescription: cleanText(copy.shortDescription),
        longDescription: cleanText(copy.longDescription),
        sellingPoints: cleanList(copy.sellingPoints),
      },
    }
  } catch {
    return createEmptyProductFactsWorkspace()
  }
}

export function saveProductFactsWorkspace(storage: Pick<Storage, 'setItem'>, workspace: ProductFactsWorkspace) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  } catch {
    // Persistence is best-effort; private browsing or quota limits must not break the assistant.
  }
}

export function formatAmazonListingCopy(copy: ProductCopyArtifacts) {
  const sections = [
    copy.amazonTitle.trim() ? `Title: ${copy.amazonTitle.trim()}` : '',
    copy.amazonBullets.length
      ? `About this item\n${copy.amazonBullets.map((bullet) => `- ${bullet.trim()}`).filter((item) => item !== '- ').join('\n')}`
      : '',
  ].filter(Boolean)
  return sections.join('\n\n')
}

export function replaceWorkspaceFactCard(workspace: ProductFactsWorkspace, card: ProductFactCard): ProductFactsWorkspace {
  return { ...workspace, card, copy: createEmptyCopy() }
}

export function mergeWorkspaceFactAnalysis(workspace: ProductFactsWorkspace, card: ProductFactCard): ProductFactsWorkspace {
  return {
    ...workspace,
    card: mergeProductFactAnalysis(workspace.card, card, workspace.rejectedFactKeys),
    copy: createEmptyCopy(),
  }
}

export function promoteWorkspaceInferences(workspace: ProductFactsWorkspace, inferenceIds: Iterable<string>): ProductFactsWorkspace {
  return { ...workspace, card: promoteProductInferences(workspace.card, inferenceIds), copy: createEmptyCopy() }
}

export function removeWorkspaceConfirmedFact(workspace: ProductFactsWorkspace, factId: string): ProductFactsWorkspace {
  const removed = workspace.card.confirmedFacts.find((fact) => fact.id === factId)
  if (!removed) return workspace
  const rejectedFactKeys = Array.from(new Set([...workspace.rejectedFactKeys, productFactDecisionKey(removed)]))
  return {
    ...workspace,
    rejectedFactKeys,
    card: { ...workspace.card, confirmedFacts: workspace.card.confirmedFacts.filter((fact) => fact.id !== factId) },
    copy: createEmptyCopy(),
  }
}
