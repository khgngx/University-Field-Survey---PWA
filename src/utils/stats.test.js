import { describe, expect, it } from 'vitest'
import { summarize } from './stats'

const s = (building, category, rating) => ({ building, category, rating })

describe('summarize', () => {
  it('returns empty aggregates and a null average for no surveys', () => {
    expect(summarize([])).toEqual({
      total: 0,
      averageRating: null,
      defectsByBuilding: {},
      countByCategory: {},
      averageRatingByCategory: {},
    })
  })

  it('counts defects (rating <= 2) per building, categories and averages', () => {
    const result = summarize([
      s('A', 'AC', 1),
      s('A', 'AC', 2),
      s('A', 'Projector', 5),
      s('B', 'AC', 3),
      s('B', 'Furniture', 2),
    ])
    expect(result.total).toBe(5)
    expect(result.averageRating).toBeCloseTo(13 / 5)
    expect(result.defectsByBuilding).toEqual({ A: 2, B: 1 })
    expect(result.countByCategory).toEqual({ AC: 3, Projector: 1, Furniture: 1 })
    expect(result.averageRatingByCategory.AC).toBeCloseTo(2)
    expect(result.averageRatingByCategory.Projector).toBe(5)
  })

  it('omits buildings that have no defects', () => {
    expect(summarize([s('A', 'AC', 5)]).defectsByBuilding).toEqual({})
  })
})
