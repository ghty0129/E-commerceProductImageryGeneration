export type ImagePlanMode = 'universal' | 'free'
export type ImageAspectRatio = '1:1' | '4:5' | '3:4' | '16:9' | '9:16'
export type ImageLongEdge = 1024 | 2048 | 4096
export type ImageOutputFormat = 'JPEG' | 'PNG' | 'WebP'

export interface PlannedImage {
  id: string
  purpose: string
  goal: string
  composition: string
  evidence: string
  copy: string
  aspectRatio: ImageAspectRatio
  resolution: ImageLongEdge
  outputFormat: ImageOutputFormat
  perImageRequirements: string
  styleOverride: string
  includeOwnedLogo: boolean
  includeOwnedWatermark: boolean
}

export interface ImageSetPlan {
  mode: ImagePlanMode
  seriesStyle: string
  images: PlannedImage[]
  selectedImageId: string | null
  warnings: string[]
  confirmationFingerprint: string | null
  confirmedAt: string | null
  updatedAt: string
}

export interface PlannedImageProposal extends Partial<Omit<PlannedImage, 'id'>> {
  purpose?: string
  goal?: string
}

export interface ImagePlanProposal {
  seriesStyle?: string
  images?: PlannedImageProposal[]
}

const ASPECT_RATIOS: readonly ImageAspectRatio[] = ['1:1', '4:5', '3:4', '16:9', '9:16']
const RESOLUTIONS: readonly ImageLongEdge[] = [1024, 2048, 4096]
const OUTPUT_FORMATS: readonly ImageOutputFormat[] = ['JPEG', 'PNG', 'WebP']

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeCount(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1
  return Math.min(12, Math.max(1, Math.trunc(numeric)))
}

function normalizeImage(value: unknown, index: number, createId: (index: number) => string, warnings: string[]): PlannedImage {
  const record = isRecord(value) ? value : {}
  const aspectRatio = ASPECT_RATIOS.includes(record.aspectRatio as ImageAspectRatio)
    ? record.aspectRatio as ImageAspectRatio
    : '1:1'
  const resolutionValue = Number(record.resolution)
  const resolution = RESOLUTIONS.includes(resolutionValue as ImageLongEdge)
    ? resolutionValue as ImageLongEdge
    : 2048
  const formatValue = cleanText(record.outputFormat)
  const outputFormat = OUTPUT_FORMATS.includes(formatValue as ImageOutputFormat)
    ? formatValue as ImageOutputFormat
    : 'JPEG'

  if (record.aspectRatio != null && aspectRatio !== record.aspectRatio) warnings.push(`Image ${index + 1} aspect ratio was repaired to 1:1.`)
  if (record.resolution != null && resolution !== resolutionValue) warnings.push(`Image ${index + 1} resolution was repaired to 2048.`)
  if (record.outputFormat != null && outputFormat !== formatValue) warnings.push(`Image ${index + 1} output format was repaired to JPEG.`)

  return {
    id: createId(index),
    purpose: cleanText(record.purpose) || `Image ${index + 1}`,
    goal: cleanText(record.goal),
    composition: cleanText(record.composition),
    evidence: cleanText(record.evidence),
    copy: cleanText(record.copy),
    aspectRatio,
    resolution,
    outputFormat,
    perImageRequirements: cleanText(record.perImageRequirements),
    styleOverride: cleanText(record.styleOverride),
    includeOwnedLogo: record.includeOwnedLogo === true,
    includeOwnedWatermark: record.includeOwnedWatermark === true,
  }
}

export function normalizeImagePlanProposal(options: {
  requestedCount: number
  proposal: unknown
  createId: (index: number) => string
  mode?: ImagePlanMode
  now?: string
}): { plan: ImageSetPlan; warnings: string[] } {
  const requestedCount = normalizeCount(options.requestedCount)
  const proposal = isRecord(options.proposal) ? options.proposal : {}
  const proposedImages = Array.isArray(proposal.images) ? proposal.images.slice(0, 12) : []
  const sourceImages = proposedImages.length ? proposedImages : Array.from({ length: requestedCount }, () => ({}))
  const warnings: string[] = []

  if (proposedImages.length && proposedImages.length !== requestedCount) {
    warnings.push(`Requested ${requestedCount} images, but AI proposed ${proposedImages.length}. Review and confirm the final set.`)
  }
  if (Array.isArray(proposal.images) && proposal.images.length > 12) {
    warnings.push('AI proposed more than 12 images. Only the first 12 were kept.')
  }

  const images = sourceImages.map((image, index) => normalizeImage(image, index, options.createId, warnings))
  const now = options.now ?? new Date().toISOString()
  const plan: ImageSetPlan = {
    mode: options.mode ?? 'free',
    seriesStyle: cleanText(proposal.seriesStyle),
    images,
    selectedImageId: images[0]?.id ?? null,
    warnings,
    confirmationFingerprint: null,
    confirmedAt: null,
    updatedAt: now,
  }

  return { plan, warnings }
}

export function createImageSetPlan(
  mode: ImagePlanMode,
  count: number,
  createId: (index: number) => string,
  now?: string,
): ImageSetPlan {
  return normalizeImagePlanProposal({ requestedCount: count, proposal: {}, createId, mode, now }).plan
}

function invalidatePlan(plan: ImageSetPlan, changes: Partial<ImageSetPlan>, now?: string): ImageSetPlan {
  return {
    ...plan,
    ...changes,
    confirmationFingerprint: null,
    confirmedAt: null,
    updatedAt: now ?? new Date().toISOString(),
  }
}

export function addPlannedImage(
  plan: ImageSetPlan,
  createId: (index: number) => string,
  now?: string,
): ImageSetPlan {
  if (plan.images.length >= 12) throw new Error('A plan cannot contain more than 12 images.')
  const index = plan.images.length
  const image = normalizeImage({}, index, createId, [])
  return invalidatePlan(plan, {
    images: [...plan.images, image],
    selectedImageId: image.id,
  }, now)
}

export function copyPlannedImage(
  plan: ImageSetPlan,
  imageId: string,
  createId: (index: number) => string,
  now?: string,
): ImageSetPlan {
  if (plan.images.length >= 12) throw new Error('A plan cannot contain more than 12 images.')
  const sourceIndex = plan.images.findIndex((image) => image.id === imageId)
  if (sourceIndex < 0) throw new Error('Planned image was not found.')
  const source = plan.images[sourceIndex]
  const copy: PlannedImage = {
    ...source,
    id: createId(plan.images.length),
    purpose: `${source.purpose} copy`,
  }
  const images = [...plan.images]
  images.splice(sourceIndex + 1, 0, copy)
  return invalidatePlan(plan, { images, selectedImageId: copy.id }, now)
}

export function deletePlannedImage(plan: ImageSetPlan, imageId: string, now?: string): ImageSetPlan {
  if (plan.images.length <= 1) throw new Error('At least one planned image is required.')
  const sourceIndex = plan.images.findIndex((image) => image.id === imageId)
  if (sourceIndex < 0) throw new Error('Planned image was not found.')
  const images = plan.images.filter((image) => image.id !== imageId)
  const selectedImageId = plan.selectedImageId === imageId
    ? (images[sourceIndex] ?? images[sourceIndex - 1])?.id ?? null
    : plan.selectedImageId
  return invalidatePlan(plan, { images, selectedImageId }, now)
}

export function movePlannedImage(plan: ImageSetPlan, imageId: string, targetIndex: number, now?: string): ImageSetPlan {
  const sourceIndex = plan.images.findIndex((image) => image.id === imageId)
  if (sourceIndex < 0) throw new Error('Planned image was not found.')
  const boundedTarget = Math.min(plan.images.length - 1, Math.max(0, Math.trunc(targetIndex)))
  if (sourceIndex === boundedTarget) return plan
  const images = [...plan.images]
  const [image] = images.splice(sourceIndex, 1)
  images.splice(boundedTarget, 0, image)
  return invalidatePlan(plan, { images }, now)
}

export function updatePlannedImage(
  plan: ImageSetPlan,
  imageId: string,
  changes: Partial<Omit<PlannedImage, 'id'>>,
  now?: string,
): ImageSetPlan {
  const sourceIndex = plan.images.findIndex((image) => image.id === imageId)
  if (sourceIndex < 0) throw new Error('Planned image was not found.')
  const images = plan.images.map((image) => image.id === imageId ? { ...image, ...changes, id: image.id } : image)
  return invalidatePlan(plan, { images }, now)
}

export function selectPlannedImage(plan: ImageSetPlan, imageId: string): ImageSetPlan {
  if (!plan.images.some((image) => image.id === imageId)) throw new Error('Planned image was not found.')
  return plan.selectedImageId === imageId ? plan : { ...plan, selectedImageId: imageId }
}

export function updateImageSetPlan(plan: ImageSetPlan, changes: { seriesStyle?: string }, now?: string): ImageSetPlan {
  return invalidatePlan(plan, {
    seriesStyle: changes.seriesStyle === undefined ? plan.seriesStyle : changes.seriesStyle.trim(),
  }, now)
}

function getConfirmationPayload(plan: ImageSetPlan) {
  return {
    mode: plan.mode,
    seriesStyle: plan.seriesStyle,
    images: plan.images.map(({ id: _id, ...image }) => image),
  }
}

function fingerprintPlan(plan: ImageSetPlan) {
  const input = JSON.stringify(getConfirmationPayload(plan))
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function confirmImageSetPlan(plan: ImageSetPlan, now?: string): ImageSetPlan {
  if (!plan.images.length) throw new Error('At least one planned image is required.')
  return {
    ...plan,
    confirmationFingerprint: fingerprintPlan(plan),
    confirmedAt: now ?? new Date().toISOString(),
  }
}

export function isImageSetPlanConfirmed(plan: ImageSetPlan) {
  return Boolean(plan.confirmationFingerprint) && plan.confirmationFingerprint === fingerprintPlan(plan)
}

export function invalidateImageSetPlanConfirmation(plan: ImageSetPlan, now?: string): ImageSetPlan {
  if (!plan.confirmationFingerprint && !plan.confirmedAt) return plan
  return invalidatePlan(plan, {}, now)
}
