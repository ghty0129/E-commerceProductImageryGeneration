import type { CreationMode } from './creationModes'

const STORAGE_KEY = 'amazon-image-studio-creation-workspace-v1'

export interface UniversalCreationDraft {
  platform: string
  imageCount: number
  globalRequirements: string
  platformNotes: string
}

export interface FreeCreationDraft {
  imageCount: number
  globalRequirements: string
  allowText: boolean
  allowOwnedLogo: boolean
  allowWatermark: boolean
}

export interface CreationWorkspace {
  activeMode: CreationMode
  universal: UniversalCreationDraft
  free: FreeCreationDraft
}

export function createEmptyCreationWorkspace(): CreationWorkspace {
  return {
    activeMode: 'amazon',
    universal: { platform: '', imageCount: 4, globalRequirements: '', platformNotes: '' },
    free: { imageCount: 4, globalRequirements: '', allowText: true, allowOwnedLogo: true, allowWatermark: true },
  }
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeCount(value: unknown, fallback = 4) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(12, Math.max(1, Math.trunc(numeric)))
}

export function loadCreationWorkspace(storage: Pick<Storage, 'getItem'>): CreationWorkspace {
  const fallback = createEmptyCreationWorkspace()
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const universal = parsed.universal && typeof parsed.universal === 'object' ? parsed.universal as Record<string, unknown> : {}
    const free = parsed.free && typeof parsed.free === 'object' ? parsed.free as Record<string, unknown> : {}
    const activeMode: CreationMode = parsed.activeMode === 'universal' || parsed.activeMode === 'free' ? parsed.activeMode : 'amazon'
    return {
      activeMode,
      universal: {
        platform: cleanText(universal.platform),
        imageCount: normalizeCount(universal.imageCount),
        globalRequirements: cleanText(universal.globalRequirements),
        platformNotes: cleanText(universal.platformNotes),
      },
      free: {
        imageCount: normalizeCount(free.imageCount),
        globalRequirements: cleanText(free.globalRequirements),
        allowText: free.allowText !== false,
        allowOwnedLogo: free.allowOwnedLogo !== false,
        allowWatermark: free.allowWatermark !== false,
      },
    }
  } catch {
    return fallback
  }
}

export function saveCreationWorkspace(storage: Pick<Storage, 'setItem'>, workspace: CreationWorkspace) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  } catch {
    // Persistence is best-effort; storage restrictions must not break mode switching.
  }
}
