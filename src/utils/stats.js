// A survey counts as a defect when the equipment is rated this low or lower.
export const DEFECT_MAX_RATING = 2

const bump = (map, key, by = 1) => {
  map[key] = (map[key] ?? 0) + by
}

export function summarize(surveys) {
  const defectsByBuilding = {}
  const countByCategory = {}
  const ratingSumByCategory = {}
  let ratingSum = 0

  for (const s of surveys) {
    bump(countByCategory, s.category)
    bump(ratingSumByCategory, s.category, s.rating)
    ratingSum += s.rating
    if (s.rating <= DEFECT_MAX_RATING) bump(defectsByBuilding, s.building)
  }

  const averageRatingByCategory = Object.fromEntries(
    Object.entries(ratingSumByCategory).map(([category, sum]) => [category, sum / countByCategory[category]]),
  )
  return {
    total: surveys.length,
    averageRating: surveys.length > 0 ? ratingSum / surveys.length : null,
    defectsByBuilding,
    countByCategory,
    averageRatingByCategory,
  }
}
