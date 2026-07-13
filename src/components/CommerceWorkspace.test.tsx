import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CommerceWorkspace, { CreationModeFoundationPanel, CreationModeTabs } from './CommerceWorkspace'
import { createEmptyCreationWorkspace } from '../lib/creationWorkspace'
import { normalizeProductFactCard } from '../lib/productFacts'
import { compileImagePrompt } from '../lib/promptCompiler'

describe('CreationModeTabs', () => {
  it('exposes all three creation modes as accessible buttons', () => {
    const markup = renderToStaticMarkup(<CreationModeTabs activeMode="universal" onChange={() => undefined} />)

    expect(markup).toContain('Amazon合规')
    expect(markup).toContain('平台通用')
    expect(markup).toContain('自由创作')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).not.toContain('role="tab"')
  })

  it('keeps the existing Listing and A+ workflow in Amazon mode with visible hard rules', () => {
    const markup = renderToStaticMarkup(<CommerceWorkspace />)

    expect(markup).toContain('Listing 图')
    expect(markup).toContain('A+ 图')
    expect(markup).toContain('已确认商品事实')
    expect(markup).toContain('Amazon主图禁止水印')
  })

  it('shows isolated universal and free requirements with structured previews', () => {
    const workspace = createEmptyCreationWorkspace()
    workspace.universal.platform = 'Walmart'
    const factCard = normalizeProductFactCard({ confirmedFacts: [{ label: 'Material', value: 'Polyester' }] })
    const setWorkspace = () => undefined
    const common = { workspace, setWorkspace, onOpenFacts: () => undefined, factCard, onGlobalRequirementsChange: () => undefined }
    const universalMarkup = renderToStaticMarkup(<CreationModeFoundationPanel {...common} mode="universal" globalRequirements="Universal draft text" compiledPrompt={compileImagePrompt({ mode: 'universal', globalRequirements: 'Universal draft text' })} />)
    const freeMarkup = renderToStaticMarkup(<CreationModeFoundationPanel {...common} mode="free" globalRequirements="Free draft text" compiledPrompt={compileImagePrompt({ mode: 'free', globalRequirements: 'Free draft text' })} />)

    expect(universalMarkup).toContain('Walmart')
    expect(universalMarkup).toContain('Universal draft text')
    expect(universalMarkup).toContain('Material：Polyester')
    expect(freeMarkup).toContain('Free draft text')
    expect(freeMarkup).toContain('允许自有水印')
    expect(universalMarkup + freeMarkup).toContain('提示词结构')
    expect(universalMarkup + freeMarkup).not.toContain('Amazon主图禁止水印')
  })
})
