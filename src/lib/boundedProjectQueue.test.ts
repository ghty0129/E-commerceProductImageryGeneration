import { describe, expect, it } from 'vitest'
import { runBoundedProjectQueue } from './boundedProjectQueue'

describe('bounded project queue', () => {
  it('limits concurrency and isolates project failures', async () => {
    let active = 0
    let peak = 0
    const results = await runBoundedProjectQueue(['a', 'bad', 'c', 'd'], async (id) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      if (id === 'bad') throw new Error('provider failed')
      return `${id}-done`
    }, 2)

    expect(peak).toBe(2)
    expect(results).toEqual([
      { item: 'a', status: 'fulfilled', value: 'a-done' },
      { item: 'bad', status: 'rejected', error: 'provider failed' },
      { item: 'c', status: 'fulfilled', value: 'c-done' },
      { item: 'd', status: 'fulfilled', value: 'd-done' },
    ])
  })
})
