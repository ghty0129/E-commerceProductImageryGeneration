export type CreationMode = 'amazon' | 'universal' | 'free'

export interface CreationModeRule {
  id: string
  label: string
  detail: string
  level: 'hard' | 'guidance'
}

export interface CreationModePolicy {
  mode: CreationMode
  label: string
  description: string
  capabilities: {
    flexibleImageCount: boolean
    onImageText: boolean
    ownedLogo: boolean
    watermark: boolean
  }
  rules: CreationModeRule[]
}

const SHARED_RULES: CreationModeRule[] = [
  { id: 'product-truth', label: '商品真实性', detail: '不得改变已确认的商品结构、数量、尺寸、材质和包装内容。', level: 'hard' },
  { id: 'owned-assets-only', label: '自有素材', detail: 'Logo、水印、商标和品牌素材必须由用户拥有或已获授权。', level: 'hard' },
]

const MODE_POLICIES: Record<CreationMode, CreationModePolicy> = {
  amazon: {
    mode: 'amazon',
    label: 'Amazon合规',
    description: '保留现有Listing与A+槽位、尺寸和Amazon合规要求。',
    capabilities: { flexibleImageCount: false, onImageText: true, ownedLogo: true, watermark: false },
    rules: [
      ...SHARED_RULES,
      { id: 'amazon-main-white-background', label: 'Amazon主图白底', detail: '主图保持纯白背景、完整商品和真实比例。', level: 'hard' },
      { id: 'amazon-main-no-watermark', label: 'Amazon主图禁止水印', detail: '主图不得添加水印、促销文案、徽章、边框或非商品图形。', level: 'hard' },
      { id: 'amazon-fixed-workflow', label: '固定平台结构', detail: 'Listing图片位和A+模块继续使用现有Amazon工作流。', level: 'hard' },
    ],
  },
  universal: {
    mode: 'universal',
    label: '平台通用',
    description: '面向非Amazon平台，按所选平台和整套要求规划图片。',
    capabilities: { flexibleImageCount: true, onImageText: true, ownedLogo: true, watermark: true },
    rules: [
      ...SHARED_RULES,
      { id: 'selected-platform-guidance', label: '所选平台规则', detail: '只加载用户选择或填写的平台要求，不继承Amazon专属限制。', level: 'guidance' },
    ],
  },
  free: {
    mode: 'free',
    label: '自由创作',
    description: '自由控制图片数量、文字、Logo、水印和视觉方向。',
    capabilities: { flexibleImageCount: true, onImageText: true, ownedLogo: true, watermark: true },
    rules: [...SHARED_RULES],
  },
}

export function getCreationModePolicy(mode: CreationMode): CreationModePolicy {
  return MODE_POLICIES[mode]
}

export const CREATION_MODES = (Object.keys(MODE_POLICIES) as CreationMode[]).map((mode) => MODE_POLICIES[mode])
