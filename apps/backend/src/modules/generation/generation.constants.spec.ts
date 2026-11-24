import { thoughtTail } from './generation.constants'

describe('thoughtTail', () => {
  it('keeps short reasoning as it is', () => {
    expect(thoughtTail('plan', 10)).toBe('plan')
    expect(thoughtTail(undefined)).toBeUndefined()
    expect(thoughtTail('')).toBeUndefined()
  })

  it('keeps only the latest characters of long reasoning', () => {
    const tail = thoughtTail('abcdefghij', 5)
    expect(tail).toBe('…ghij')
    expect(tail).toHaveLength(5)
  })
})
