import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CommerceWorkspace, { CreationModeFoundationPanel, CreationModeTabs } from './CommerceWorkspace'
import { createEmptyCreationWorkspace } from '../lib/creationWorkspace'
import { normalizeProductFactCard } from '../lib/productFacts'

describe('CreationModeTabs', () => {
  it('exposes all three creation modes as accessible tabs', () => {
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

  it('shows isolated universal and free drafts without Amazon watermark rules', () => {
    const workspace = createEmptyCreationWorkspace()
    workspace.universal.platform = 'Walmart'
    workspace.universal.globalRequirements = 'Universal draft text'
    workspace.free.globalRequirements = 'Free draft text'
    const factCard = normalizeProductFactCard({ confirmedFacts: [{ label: 'Material', value: 'Polyester' }] })
    const setWorkspace = () => undefined
    const universalMarkup = renderToStaticMarkup(<CreationModeFoundationPanel mode="universal" workspace={workspace} setWorkspace={setWorkspace} onOpenFacts={() => undefined} factCard={factCard} />)
    const freeMarkup = renderToStaticMarkup(<CreationModeFoundationPanel mode="free" workspace={workspace} setWorkspace={setWorkspace} onOpenFacts={() => undefined} factCard={factCard} />)

    expect(universalMarkup).toContain('Walmart')
    expect(universalMarkup).toContain('Universal draft text')
    expect(universalMarkup).toContain('Material：Polyester')
    expect(freeMarkup).toContain('Free draft text')
    expect(freeMarkup).toContain('允许自有水印')
    expect(universalMarkup + freeMarkup).not.toContain('Amazon主图禁止水印')
  })
})
