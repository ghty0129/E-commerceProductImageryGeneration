import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { compileImagePrompt } from '../lib/promptCompiler'
import PromptStructurePreview from './PromptStructurePreview'

describe('PromptStructurePreview', () => {
  it('shows section source, priority, and blocking diagnostics', () => {
    const compiled = compileImagePrompt({
      mode: 'amazon',
      amazonSlot: 'MAIN',
      globalRequirements: 'Add a watermark in the lower right.',
      imageGoal: 'Create the main image.',
    })

    const markup = renderToStaticMarkup(<PromptStructurePreview compiled={compiled} />)

    expect(markup).toContain('提示词结构')
    expect(markup).toContain('优先级 1')
    expect(markup).toContain('Amazon合规 模式规则')
    expect(markup).toContain('阻止生成')
    expect(markup).toContain('水印与 Amazon 规则冲突')
  })
})
