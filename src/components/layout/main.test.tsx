import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Main } from './main'

vi.mock('@/components/contextual-help-links', () => ({
  ContextualHelpLinks: () => null,
}))

describe('Main layout container', () => {
  it('uses the available workspace width by default', () => {
    const { container } = render(<Main>Content</Main>)

    const main = container.querySelector('main')

    expect(main?.className).toContain('px-4')
    expect(main?.className).not.toContain('max-w-7xl')
    expect(main?.className).not.toContain('@7xl/content:mx-auto')
  })

  it('keeps an explicit constrained mode for narrow surfaces', () => {
    const { container } = render(<Main constrained>Content</Main>)

    const main = container.querySelector('main')

    expect(main?.className).toContain('@7xl/content:mx-auto')
    expect(main?.className).toContain('@7xl/content:w-full')
    expect(main?.className).toContain('@7xl/content:max-w-7xl')
  })
})
