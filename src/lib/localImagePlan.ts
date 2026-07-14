import { normalizeImagePlanProposal, type ImagePlanMode, type ImageSetPlan, type PlannedImageProposal } from './imageSetPlan'

const TEMPLATES: Array<PlannedImageProposal & { seriesRole: string }> = [
  { seriesRole: '建立第一印象', purpose: '商品主视觉', goal: '清晰呈现完整商品与主要外观，让用户第一眼识别商品', composition: '商品居中或略偏三分线，主体完整，背景简洁，保留自然阴影和充足留白', copy: '主标题仅使用已确认的产品名称；可配一条已确认的核心用途', aspectRatio: '1:1', perImageRequirements: '主体外观、颜色、结构和数量必须与参考图及已确认事实一致，不添加未经确认的卖点' },
  { seriesRole: '解释使用情境', purpose: '使用场景', goal: '展示商品在真实使用环境中的位置、尺度与使用方式', composition: '以自然生活场景为主，商品保持视觉中心，人物或道具只用于解释用途且不遮挡主体', copy: '用一条简短场景标题说明使用情境，不写未经确认的性能结论', aspectRatio: '4:5', perImageRequirements: '场景、人物和道具可以重新设计；不得改变商品本身结构或暗示未确认功能' },
  { seriesRole: '突出核心卖点', purpose: '核心卖点展示', goal: '聚焦一个最重要且已经确认的商品特点', composition: '主体与卖点说明分区排版，用局部放大或简洁引导线指向对应位置', copy: '仅提炼一个已确认卖点，标题和说明避免与其他图片重复', aspectRatio: '1:1', perImageRequirements: '卖点必须来自已确认事实；没有足够事实时使用纯视觉展示，不虚构文案' },
  { seriesRole: '展示材质工艺', purpose: '材质与细节', goal: '通过近景展示材质纹理、接口、边缘或做工细节', composition: '使用一个主要细节特写，可配一至两个辅助局部框，光线突出真实纹理', copy: '标注可确认的材质或结构名称，不使用夸张质量承诺', aspectRatio: '1:1', perImageRequirements: '细节必须能够从参考图或已确认事实获得支持，不生成不存在的零件或纹理' },
  { seriesRole: '说明尺寸尺度', purpose: '尺寸与尺度', goal: '帮助用户理解商品尺寸、比例或收纳后的空间占用', composition: '商品正视或侧视，使用简洁尺寸线；缺少确切尺寸时改用常见物体作非数值尺度参考', copy: '只展示用户已确认的尺寸和单位；数据缺失时不得编造数字', aspectRatio: '1:1', perImageRequirements: '所有数字、单位和比例必须保持原始事实，禁止估算或换算未提供的数据' },
  { seriesRole: '说明使用流程', purpose: '使用步骤', goal: '用连续画面说明商品的基本使用、展开、安装或收纳方式', composition: '采用二至四步顺序布局，每一步保持商品方向清晰并使用简洁编号', copy: '每步使用短动词说明；仅描述从资料中能够确认的动作', aspectRatio: '4:5', perImageRequirements: '不展示无法从商品资料确认的安装方式、安全步骤或兼容关系' },
  { seriesRole: '补充次级卖点', purpose: '辅助卖点展示', goal: '展示与主卖点不同的第二个已确认特点或用途', composition: '使用左右或上下分区，主体与辅助细节形成清晰视觉层级', copy: '使用不同于主视觉和核心卖点图的标题表达，仍只引用已确认事实', aspectRatio: '1:1', perImageRequirements: '与前面图片形成信息互补，不重复同一构图、同一标题或同一卖点' },
  { seriesRole: '交代包装内容', purpose: '包装与清单', goal: '清楚展示包装内实际包含的商品及配件', composition: '俯拍或整齐平铺，各物品互不遮挡并与清单顺序对应', copy: '仅列出已确认的包装数量与配件名称；未知时显示商品本体且不列数量', aspectRatio: '1:1', perImageRequirements: '不得添加参考资料中未确认的配件、赠品、包装数量或品牌包装' },
  { seriesRole: '形成传播画面', purpose: '竖版创意海报', goal: '用更自由的视觉语言形成适合移动端浏览的品牌氛围画面', composition: '纵向层次构图，主体占据中上部，背景强化氛围，底部保留可选文案区域', copy: '使用短标题表达已确认用途；需要 Logo 或水印时只使用用户自有素材', aspectRatio: '9:16', perImageRequirements: '可以自由更换背景、人物和道具，但商品真实特征必须一致，避免套用其他图片固定版式' },
  { seriesRole: '补足观察角度', purpose: '多角度展示', goal: '从与主图不同的视角补充商品背面、侧面或展开状态', composition: '选择一个信息量最高的不同角度，背景与主视觉保持系列一致但机位明显不同', copy: '原则上少文字；必要时仅标注视角或已确认结构名称', aspectRatio: '1:1', perImageRequirements: '不要凭空补全参考图未展示且无法确定的背面结构' },
  { seriesRole: '建立品质信任', purpose: '品质说明', goal: '用真实细节和克制排版增强对商品做工与信息透明度的信任', composition: '主体局部与材料细节组合，使用干净的信息卡片呈现已确认内容', copy: '只陈述可验证的材质、工艺或结构事实，不使用认证、耐用性或安全性承诺', aspectRatio: '4:5', perImageRequirements: '不添加未提供的检测标志、认证图标、评分、奖项或性能数据' },
  { seriesRole: '完成整套收束', purpose: '品牌收束图', goal: '以区别于主图的环境和机位完成整套图片的视觉收束', composition: '商品与简洁品牌氛围结合，构图留白充分，可呈现多个已确认使用场景的暗示元素', copy: '使用简短收束语；如加入 Logo 或水印，只使用用户确认拥有权利的素材', aspectRatio: '4:5', perImageRequirements: '不得出现第三方品牌、平台徽章、未经授权人物形象或与前图相同的文案' },
]

export function createLocalImagePlan(options: {
  mode: ImagePlanMode
  count: number
  description?: string
  createId: (index: number) => string
  reconstructionIntensity?: string
  referenceCount?: number
}): ImageSetPlan {
  const count = Math.min(12, Math.max(1, Math.trunc(options.count) || 1))
  const brief = options.description?.trim() || '根据商品参考图和已确认商品事实完成策划'
  const isReconstruction = Boolean(options.reconstructionIntensity)
  const images = Array.from({ length: count }, (_, index) => {
    const template = TEMPLATES[index]
    const referenceNote = isReconstruction
      ? `以参考图 ${(index % Math.max(1, options.referenceCount ?? count)) + 1} 的营销目的为线索，执行${options.reconstructionIntensity}，不复制原背景、人物、道具、文字和固定构图。`
      : ''
    return {
      ...template,
      goal: `${template.goal}。商品需求：${brief}`,
      evidence: `本图承担“${template.seriesRole}”的独立任务，与第 ${index + 1} 张图片对应。`,
      perImageRequirements: `${referenceNote}${template.perImageRequirements}`,
    }
  })
  return normalizeImagePlanProposal({
    requestedCount: count,
    proposal: {
      seriesStyle: options.mode === 'free'
        ? '整套保持商品外观一致，允许更自由地变化背景、人物、机位、光线与版式；每张图承担不同信息任务。'
        : '整套保持商品外观、色彩与品牌语言一致，采用清晰、可信、适合跨境电商平台的商业摄影风格。',
      images,
    },
    createId: options.createId,
    mode: options.mode,
  }).plan
}
