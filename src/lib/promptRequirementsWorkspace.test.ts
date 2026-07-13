import { describe, expect, it } from 'vitest'
import {
  createEmptyPromptRequirementWorkspace,
  loadPromptRequirementWorkspace,
  savePromptRequirementWorkspace,
} from './promptRequirementsWorkspace'

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
  }
}

describe('prompt requirements workspace', () => {
  it('persists isolated global and per-image requirements for every mode', () => {
    const storage = memoryStorage()
    const workspace = createEmptyPromptRequirementWorkspace()
    workspace.amazon.globalRequirements = 'Amazon set direction'
    workspace.amazon.perImageRequirements.MAIN = 'No copy'
    workspace.universal.globalRequirements = 'Marketplace direction'
    workspace.universal.perImageRequirements['image-2'] = 'Use comparison layout'
    workspace.free.globalRequirements = 'Experimental direction'
    workspace.free.perImageRequirements['image-1'] = 'Owned watermark lower right'

    savePromptRequirementWorkspace(storage, workspace)

    expect(loadPromptRequirementWorkspace(storage)).toEqual(workspace)
  })

  it('migrates existing universal and free global requirements once', () => {
    const storage = memoryStorage()

    const restored = loadPromptRequirementWorkspace(storage, {
      universal: 'Legacy marketplace direction',
      free: 'Legacy free direction',
    })

    expect(restored.universal.globalRequirements).toBe('Legacy marketplace direction')
    expect(restored.free.globalRequirements).toBe('Legacy free direction')
    expect(restored.amazon.globalRequirements).toBe('')
  })

  it('normalizes corrupt values without leaking requirements between modes', () => {
    const storage = memoryStorage(JSON.stringify({
      amazon: { globalRequirements: 7, perImageRequirements: { MAIN: 'Keep product centered', ALT: 3 } },
      universal: null,
      free: { globalRequirements: 'Free only', perImageRequirements: ['bad'] },
    }))

    const restored = loadPromptRequirementWorkspace(storage)

    expect(restored.amazon).toEqual({ globalRequirements: '', perImageRequirements: { MAIN: 'Keep product centered' } })
    expect(restored.universal).toEqual({ globalRequirements: '', perImageRequirements: {} })
    expect(restored.free).toEqual({ globalRequirements: 'Free only', perImageRequirements: {} })
  })
})
