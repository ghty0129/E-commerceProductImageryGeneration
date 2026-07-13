import { createImageSetPlan, type ImageSetPlan, type ImagePlanMode } from './imageSetPlan'

const KEY = 'amazon-image-studio-flexible-plans-v1'
export type FlexiblePlanWorkspace = Record<ImagePlanMode, ImageSetPlan>

const ids = (mode: ImagePlanMode) => (index: number) => `${mode}-image-${index + 1}`

export function createEmptyFlexiblePlanWorkspace(): FlexiblePlanWorkspace {
  return {
    universal: createImageSetPlan('universal', 4, ids('universal')),
    free: createImageSetPlan('free', 4, ids('free')),
  }
}

function validPlan(value: unknown, mode: ImagePlanMode): ImageSetPlan {
  if (!value || typeof value !== 'object') return createImageSetPlan(mode, 4, ids(mode))
  const plan = value as ImageSetPlan
  if (plan.mode !== mode || !Array.isArray(plan.images) || plan.images.length < 1 || plan.images.length > 12) return createImageSetPlan(mode, 4, ids(mode))
  return plan
}

export function loadFlexiblePlanWorkspace(storage: Pick<Storage, 'getItem'>): FlexiblePlanWorkspace {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return createEmptyFlexiblePlanWorkspace()
    const value = JSON.parse(raw) as Record<string, unknown>
    return { universal: validPlan(value.universal, 'universal'), free: validPlan(value.free, 'free') }
  } catch { return createEmptyFlexiblePlanWorkspace() }
}

export function saveFlexiblePlanWorkspace(storage: Pick<Storage, 'setItem'>, workspace: FlexiblePlanWorkspace) {
  try { storage.setItem(KEY, JSON.stringify(workspace)) } catch { /* best effort */ }
}
