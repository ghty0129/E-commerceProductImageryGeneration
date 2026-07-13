import { describe, expect, it } from 'vitest'
import { getCreationModePolicy } from './creationModes'

describe('creation mode policy', () => {
  it('keeps Amazon hard rules inside Amazon compliance mode', () => {
    const policy = getCreationModePolicy('amazon')

    expect(policy.rules.map((rule) => rule.id)).toContain('amazon-main-no-watermark')
    expect(policy.capabilities.watermark).toBe(false)
    expect(policy.capabilities.flexibleImageCount).toBe(false)
  })

  it('allows owned logos and watermarks in free creation mode without Amazon rules', () => {
    const policy = getCreationModePolicy('free')

    expect(policy.capabilities).toMatchObject({ watermark: true, ownedLogo: true, flexibleImageCount: true })
    expect(policy.rules.some((rule) => rule.id.startsWith('amazon-'))).toBe(false)
  })

  it('keeps universal platform rules platform-neutral in this foundation phase', () => {
    const policy = getCreationModePolicy('universal')

    expect(policy.rules.map((rule) => rule.id)).toEqual(['product-truth', 'owned-assets-only', 'selected-platform-guidance'])
    expect(policy.capabilities.flexibleImageCount).toBe(true)
  })
})
