import { describe, expect, it } from 'vitest'
import { createLocalImagePlan } from './localImagePlan'

describe('local image plan', () => {
  it('creates complete and distinct cards from a short description', () => {
    const plan = createLocalImagePlan({
      mode: 'universal',
      count: 6,
      description: '黑色可折叠旅行袋',
      createId: (index) => `image-${index + 1}`,
    })

    expect(plan.images).toHaveLength(6)
    for (const image of plan.images) {
      expect(image.purpose).not.toBe('')
      expect(image.goal).toContain('黑色可折叠旅行袋')
      expect(image.composition).not.toBe('')
      expect(image.copy).not.toBe('')
      expect(image.perImageRequirements).not.toBe('')
    }
    expect(new Set(plan.images.map((image) => image.purpose)).size).toBe(6)
    expect(new Set(plan.images.map((image) => image.copy)).size).toBe(6)
    expect(new Set(plan.images.map((image) => image.composition)).size).toBe(6)
  })

  it('adds per-reference reconstruction guidance without copying source layouts', () => {
    const plan = createLocalImagePlan({
      mode: 'free',
      count: 3,
      description: '',
      reconstructionIntensity: '深度原创',
      referenceCount: 3,
      createId: (index) => `rebuild-${index + 1}`,
    })

    expect(plan.images[0]?.perImageRequirements).toContain('参考图 1')
    expect(plan.images[1]?.perImageRequirements).toContain('参考图 2')
    expect(plan.images[2]?.perImageRequirements).toContain('参考图 3')
    expect(plan.images.every((image) => image.perImageRequirements.includes('不复制'))).toBe(true)
  })
})
