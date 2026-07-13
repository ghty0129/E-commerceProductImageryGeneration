import type { CreationMode } from './creationModes'

const STORAGE_KEY = 'amazon-image-studio-prompt-requirements-v1'

export interface ModePromptRequirements {
  globalRequirements: string
  perImageRequirements: Record<string, string>
}

export type PromptRequirementWorkspace = Record<CreationMode, ModePromptRequirements>

export interface LegacyGlobalRequirements {
  universal?: string
  free?: string
}

function emptyModeRequirements(globalRequirements = ''): ModePromptRequirements {
  return { globalRequirements, perImageRequirements: {} }
}

export function createEmptyPromptRequirementWorkspace(legacy: LegacyGlobalRequirements = {}): PromptRequirementWorkspace {
  return {
    amazon: emptyModeRequirements(),
    universal: emptyModeRequirements(legacy.universal ?? ''),
    free: emptyModeRequirements(legacy.free ?? ''),
  }
}

function normalizeMode(value: unknown): ModePromptRequirements {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyModeRequirements()
  const candidate = value as Record<string, unknown>
  const perImageRequirements: Record<string, string> = {}
  if (candidate.perImageRequirements && typeof candidate.perImageRequirements === 'object' && !Array.isArray(candidate.perImageRequirements)) {
    for (const [slot, requirement] of Object.entries(candidate.perImageRequirements as Record<string, unknown>)) {
      if (typeof requirement === 'string') perImageRequirements[slot] = requirement
    }
  }
  return {
    globalRequirements: typeof candidate.globalRequirements === 'string' ? candidate.globalRequirements : '',
    perImageRequirements,
  }
}

export function loadPromptRequirementWorkspace(
  storage: Pick<Storage, 'getItem'>,
  legacy: LegacyGlobalRequirements = {},
): PromptRequirementWorkspace {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyPromptRequirementWorkspace(legacy)
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      amazon: normalizeMode(parsed.amazon),
      universal: normalizeMode(parsed.universal),
      free: normalizeMode(parsed.free),
    }
  } catch {
    return createEmptyPromptRequirementWorkspace(legacy)
  }
}

export function savePromptRequirementWorkspace(
  storage: Pick<Storage, 'setItem'>,
  workspace: PromptRequirementWorkspace,
) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  } catch {
    // Persistence is best-effort; unavailable storage must not block planning.
  }
}
