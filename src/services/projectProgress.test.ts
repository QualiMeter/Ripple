import { describe, expect, it } from 'vitest'
import { calculateProjectProgress } from './projectProgress'

describe('calculateProjectProgress', () => {
  it('gives every task equal weight', () => {
    expect(calculateProjectProgress(2, 8)).toBe(25)
  })

  it('returns zero for an empty project without producing NaN', () => {
    expect(calculateProjectProgress(0, 0)).toBe(0)
  })
})
