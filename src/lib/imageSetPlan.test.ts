import { describe, expect, it } from 'vitest'
import { addPlannedImage, confirmImageSetPlan, copyPlannedImage, createImageSetPlan, deletePlannedImage, isImageSetPlanConfirmed, movePlannedImage, normalizeImagePlanProposal, selectPlannedImage, updateImageSetPlan, updatePlannedImage } from './imageSetPlan'

describe('image set plan proposal normalization', () => {
  it('normalizes a four-image mixed proposal without changing its order', () => {
    const result = normalizeImagePlanProposal({
      requestedCount: 4,
      proposal: {
        seriesStyle: 'Clean outdoor editorial set',
        images: [
          { purpose: 'Lifestyle 1', goal: 'Show commuting use', aspectRatio: '4:5', resolution: 2048, outputFormat: 'JPEG' },
          { purpose: 'Lifestyle 2', goal: 'Show weekend use', aspectRatio: '4:5', resolution: 2048, outputFormat: 'JPEG' },
          { purpose: 'Detail', goal: 'Show material texture', aspectRatio: '1:1', resolution: 4096, outputFormat: 'PNG' },
          { purpose: 'Poster', goal: 'Create a vertical hero', aspectRatio: '9:16', resolution: 2048, outputFormat: 'WebP' },
        ],
      },
      createId: (index) => `image-${index + 1}`,
    })

    expect(result.plan.images.map((image) => [image.id, image.purpose, image.aspectRatio])).toEqual([
      ['image-1', 'Lifestyle 1', '4:5'],
      ['image-2', 'Lifestyle 2', '4:5'],
      ['image-3', 'Detail', '1:1'],
      ['image-4', 'Poster', '9:16'],
    ])
    expect(result.plan.seriesStyle).toBe('Clean outdoor editorial set')
    expect(result.warnings).toEqual([])
  })

  it('repairs unsupported technical settings and reports count ambiguity', () => {
    const result = normalizeImagePlanProposal({
      requestedCount: 4,
      proposal: {
        images: [
          { purpose: 'Hero', aspectRatio: 'square', resolution: 3000, outputFormat: 'JPG' },
          { purpose: 'Detail', aspectRatio: '1:1', resolution: 4096, outputFormat: 'PNG' },
          { purpose: 'Poster', aspectRatio: '9:16', resolution: 2048, outputFormat: 'WebP' },
        ],
      },
      createId: (index) => `image-${index + 1}`,
    })

    expect(result.plan.images).toHaveLength(3)
    expect(result.plan.images[0]).toMatchObject({ aspectRatio: '1:1', resolution: 2048, outputFormat: 'JPEG' })
    expect(result.warnings).toEqual([
      'Requested 4 images, but AI proposed 3. Review and confirm the final set.',
      'Image 1 aspect ratio was repaired to 1:1.',
      'Image 1 resolution was repaired to 2048.',
      'Image 1 output format was repaired to JPEG.',
    ])
  })
})

describe('image set plan editing', () => {
  it('creates and adds cards while enforcing the 12-image maximum', () => {
    const plan = createImageSetPlan('universal', 2, (index) => `initial-${index + 1}`, '2026-07-13T10:00:00.000Z')

    expect(plan.images.map((image) => image.id)).toEqual(['initial-1', 'initial-2'])
    expect(plan.selectedImageId).toBe('initial-1')

    const added = addPlannedImage(plan, () => 'added-3', '2026-07-13T10:05:00.000Z')
    expect(added.images).toHaveLength(3)
    expect(added.images[2]).toMatchObject({ id: 'added-3', purpose: 'Image 3' })
    expect(added.selectedImageId).toBe('added-3')

    const full = createImageSetPlan('free', 12, (index) => `full-${index + 1}`)
    expect(() => addPlannedImage(full, () => 'overflow')).toThrow('A plan cannot contain more than 12 images.')
  })

  it('copies a card immediately after its source with a new identity', () => {
    const plan = normalizeImagePlanProposal({
      requestedCount: 2,
      proposal: { images: [{ purpose: 'Hero' }, { purpose: 'Lifestyle 2', copy: 'COMMUTE READY' }] },
      createId: (index) => `image-${index + 1}`,
    }).plan

    const copied = copyPlannedImage(plan, 'image-2', () => 'image-copy', '2026-07-13T10:05:00.000Z')

    expect(copied.images.map((image) => image.id)).toEqual(['image-1', 'image-2', 'image-copy'])
    expect(copied.images[2]).toMatchObject({ purpose: 'Lifestyle 2 copy', copy: 'COMMUTE READY' })
    expect(copied.selectedImageId).toBe('image-copy')
  })

  it('deletes a card, selects a neighbor, and preserves the one-card minimum', () => {
    const plan = createImageSetPlan('free', 3, (index) => `image-${index + 1}`)
    const deleted = deletePlannedImage({ ...plan, selectedImageId: 'image-2' }, 'image-2', '2026-07-13T10:05:00.000Z')

    expect(deleted.images.map((image) => image.id)).toEqual(['image-1', 'image-3'])
    expect(deleted.selectedImageId).toBe('image-3')
    expect(() => deletePlannedImage(createImageSetPlan('free', 1, () => 'only'), 'only')).toThrow('At least one planned image is required.')
  })

  it('moves a card to a bounded target index without changing its identity', () => {
    const plan = createImageSetPlan('free', 4, (index) => `image-${index + 1}`)

    const moved = movePlannedImage(plan, 'image-4', 0, '2026-07-13T10:05:00.000Z')
    expect(moved.images.map((image) => image.id)).toEqual(['image-4', 'image-1', 'image-2', 'image-3'])
    expect(movePlannedImage(moved, 'image-4', 99).images.map((image) => image.id)).toEqual(['image-1', 'image-2', 'image-3', 'image-4'])
  })

  it('updates editable card fields while selection changes only the active card', () => {
    const plan = createImageSetPlan('free', 2, (index) => `image-${index + 1}`, '2026-07-13T10:00:00.000Z')
    const updated = updatePlannedImage(plan, 'image-2', {
      purpose: 'Vertical poster', aspectRatio: '9:16', outputFormat: 'WebP', includeOwnedWatermark: true,
    }, '2026-07-13T10:05:00.000Z')

    expect(updated.images[1]).toMatchObject({
      id: 'image-2', purpose: 'Vertical poster', aspectRatio: '9:16', outputFormat: 'WebP', includeOwnedWatermark: true,
    })
    expect(updated.updatedAt).toBe('2026-07-13T10:05:00.000Z')

    const selected = selectPlannedImage(updated, 'image-2')
    expect(selected.selectedImageId).toBe('image-2')
    expect(selected.updatedAt).toBe(updated.updatedAt)
  })
})

describe('image set plan confirmation', () => {
  it('confirms the current fingerprint, ignores selection, and invalidates after content changes', () => {
    const plan = normalizeImagePlanProposal({
      requestedCount: 2,
      proposal: { seriesStyle: 'Clean studio set', images: [{ purpose: 'Hero' }, { purpose: 'Detail' }] },
      createId: (index) => `image-${index + 1}`,
      now: '2026-07-13T10:00:00.000Z',
    }).plan

    const confirmed = confirmImageSetPlan(plan, '2026-07-13T10:05:00.000Z')
    expect(confirmed.confirmationFingerprint).toMatch(/^[a-f0-9]{8}$/)
    expect(confirmed.confirmedAt).toBe('2026-07-13T10:05:00.000Z')
    expect(isImageSetPlanConfirmed(confirmed)).toBe(true)
    expect(isImageSetPlanConfirmed(selectPlannedImage(confirmed, 'image-2'))).toBe(true)

    const editedCard = updatePlannedImage(confirmed, 'image-1', { copy: 'NEW HEADLINE' })
    expect(editedCard.confirmationFingerprint).toBeNull()
    expect(isImageSetPlanConfirmed(editedCard)).toBe(false)

    const editedSet = updateImageSetPlan(confirmed, { seriesStyle: 'Warm lifestyle set' })
    expect(isImageSetPlanConfirmed(editedSet)).toBe(false)
  })
})
