import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CreationModeTabs } from './CommerceWorkspace'

describe('CreationModeTabs', () => {
  it('exposes all three creation modes as accessible tabs', () => {
    const markup = renderToStaticMarkup(<CreationModeTabs activeMode="universal" onChange={() => undefined} />)

    expect(markup).toContain('Amazon合规')
    expect(markup).toContain('平台通用')
    expect(markup).toContain('自由创作')
    expect(markup).toContain('aria-selected="true"')
  })
})
