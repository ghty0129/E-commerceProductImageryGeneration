import { describe, expect, it } from 'vitest'
import { compileImagePrompt, diagnosePromptConflicts } from './promptCompiler'
import { buildAmazonPlanPrompt, buildAmazonPromptParts } from './listingPlanner'

describe('prompt compiler', () => {
  it('compiles structured sections in explicit priority order', () => {
    const result = compileImagePrompt({
      mode: 'free',
      globalRequirements: 'Use a cool blue technology direction.',
      perImageRequirements: 'Place the owned logo in the upper right.',
      confirmedProductFacts: 'Material: Polyester\nColor: Black',
      imageGoal: 'Create a lifestyle image.',
      compositionAndCopy: 'Product on the left; owned headline on the right.',
      visualStyle: 'Warm cream editorial style.',
      seriesConsistency: 'Keep the product identical across the set.',
      technicalRequirements: '2048x2048 JPEG.',
      negativePrompt: 'blur, distorted product',
    })

    expect(result.sections.map((section) => section.kind)).toEqual([
      'mode-rules', 'global-requirements', 'per-image-requirements', 'product-facts',
      'image-goal', 'composition-copy', 'visual-style', 'series-consistency', 'technical', 'negative',
    ])
    expect(result.finalPrompt.indexOf('cool blue')).toBeLessThan(result.finalPrompt.indexOf('Warm cream'))
    expect(result.finalPrompt).toContain('User requirements override conflicting default visual style guidance')
    expect(result.canSubmit).toBe(true)
  })

  it('keeps confirmed product facts above image planning and style', () => {
    const result = compileImagePrompt({
      mode: 'universal',
      confirmedProductFacts: 'Product color: Black',
      imageGoal: 'Show the product in use.',
      visualStyle: 'Minimal studio photography.',
    })

    const facts = result.sections.find((section) => section.kind === 'product-facts')
    const style = result.sections.find((section) => section.kind === 'visual-style')
    expect(facts?.priority).toBeLessThan(style?.priority ?? 0)
    expect(facts?.content).toContain('Black')
  })

  it('preserves existing Amazon plan, style, series, density, guard, and negative content', () => {
    const options = {
      prompt: 'Create an Amazon secondary image with three feature callouts.',
      negativePrompt: 'price, reviews, distorted product',
      seriesStyleGuide: 'Keep cool blue lighting across the set.',
      styleReferenceAttached: true,
      styleDensityMode: 'rich' as const,
      selectedVisualStyle: { label: 'Clean tech', description: 'Cool precise studio styling.', palette: ['#FFFFFF', '#38BDF8'] },
    }
    const legacyPrompt = buildAmazonPlanPrompt(options)
    const parts = buildAmazonPromptParts(options)
    const compiled = compileImagePrompt({
      mode: 'amazon',
      amazonSlot: 'PT01',
      imageGoal: parts.imageGoal,
      visualStyle: [parts.selectedVisualStyle, parts.styleDensityGuide, parts.styleReferenceGuard].filter(Boolean).join('\n\n'),
      seriesConsistency: parts.seriesStyleGuide,
      negativePrompt: parts.negativePrompt,
    })

    for (const expected of [
      'three feature callouts', 'Selected visual style', 'Cool precise studio styling',
      'Keep cool blue lighting', 'information-rich Amazon gallery layout',
      'hidden style reference', 'price, reviews, distorted product',
    ]) {
      expect(legacyPrompt).toContain(expected)
      expect(compiled.finalPrompt).toContain(expected)
    }
  })
})

describe('prompt conflict diagnostics', () => {
  it('blocks a watermark request in Amazon mode', () => {
    const diagnostics = diagnosePromptConflicts({ mode: 'amazon', amazonSlot: 'MAIN', globalRequirements: '右下角添加半透明水印' })

    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'amazon-watermark', severity: 'blocker' }))
  })

  it.each([
    ['Show $19.99 in the corner', 'amazon-price-promotion'],
    ['Add a 10% off badge', 'amazon-price-promotion'],
    ['显示到手价 ¥99', 'amazon-price-promotion'],
    ['Add 4.8 stars beside the product', 'amazon-rating-badge'],
    ['展示 4.8 星评分', 'amazon-rating-badge'],
  ])('blocks common Amazon commercial proof request %s', (requirement, expectedCode) => {
    const diagnostics = diagnosePromptConflicts({ mode: 'amazon', globalRequirements: requirement })

    expect(diagnostics).toContainEqual(expect.objectContaining({ code: expectedCode, severity: 'blocker' }))
  })

  it('allows an owned watermark in free mode and reminds the user about rights', () => {
    const diagnostics = diagnosePromptConflicts({ mode: 'free', globalRequirements: 'Add my owned-brand watermark in the lower right.' })

    expect(diagnostics.some((item) => item.severity === 'blocker')).toBe(false)
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'owned-asset-rights', severity: 'info' }))
  })

  it('warns when a user requirement conflicts with the negative prompt', () => {
    const diagnostics = diagnosePromptConflicts({
      mode: 'free',
      perImageRequirements: 'Include a person using the product.',
      negativePrompt: 'no people, no person, empty scene',
    })

    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'requirement-negative-conflict', severity: 'warning' }))
  })
})
