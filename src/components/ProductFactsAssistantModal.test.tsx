import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductFactsAssistantModal from './ProductFactsAssistantModal'

describe('ProductFactsAssistantModal', () => {
  it('renders the fact review and copy workflow as one accessible dialog', () => {
    const markup = renderToStaticMarkup(
      <ProductFactsAssistantModal
        profile={null}
        profileError="缺少API配置"
        referenceImageDataUrls={[]}
        onApplyAmazonCopy={() => undefined}
        onClose={() => undefined}
        onOpenApiSettings={() => undefined}
      />,
    )

    expect(markup).toContain('aria-label="商品资料助手"')
    expect(markup).toContain('我对产品的描述')
    expect(markup).toContain('待确认推测')
    expect(markup).toContain('生成商品文案')
    expect(markup).toContain('回填到Amazon策划')
  })
})
