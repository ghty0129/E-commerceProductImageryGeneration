import { describe, expect, it } from 'vitest'
import { createEmptyCreationWorkspace, loadCreationWorkspace, saveCreationWorkspace } from './creationWorkspace'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('creation workspace', () => {
  it('restores independent drafts for all creation modes', () => {
    const storage = new MemoryStorage()
    const workspace = createEmptyCreationWorkspace()
    workspace.activeMode = 'free'
    workspace.universal.platform = 'Walmart'
    workspace.universal.globalRequirements = 'Clean marketplace gallery'
    workspace.free.globalRequirements = 'Add a translucent owned-brand watermark'
    workspace.free.allowWatermark = true

    saveCreationWorkspace(storage, workspace)
    const restored = loadCreationWorkspace(storage)

    expect(restored.activeMode).toBe('free')
    expect(restored.universal).toMatchObject({ platform: 'Walmart', globalRequirements: 'Clean marketplace gallery' })
    expect(restored.free).toMatchObject({ globalRequirements: 'Add a translucent owned-brand watermark', allowWatermark: true })
  })

  it('normalizes corrupt persisted counts without changing the other draft', () => {
    const storage = new MemoryStorage()
    storage.setItem('amazon-image-studio-creation-workspace-v1', JSON.stringify({
      activeMode: 'universal',
      universal: { imageCount: 99, platform: 'eBay' },
      free: { imageCount: -4, globalRequirements: 'Keep this draft' },
    }))

    const restored = loadCreationWorkspace(storage)

    expect(restored.universal.imageCount).toBe(12)
    expect(restored.free.imageCount).toBe(1)
    expect(restored.free.globalRequirements).toBe('Keep this draft')
  })
})
