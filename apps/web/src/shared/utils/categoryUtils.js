export const UNCATEGORIZED_CATEGORY_LABEL = 'Uncategorized'

export const ALLOWED_INVENTORY_CATEGORIES = [
  'Korean Noodles',
  'Samgyup bowl meat',
  'Samgyup meat',
  'Seaweed',
]

function collapseCategoryWhitespace(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeCategoryComparison(value) {
  return collapseCategoryWhitespace(value).toLowerCase()
}

export function getCanonicalAllowedInventoryCategory(value) {
  const normalizedValue = normalizeCategoryComparison(value)

  return (
    ALLOWED_INVENTORY_CATEGORIES.find(
      (category) => normalizeCategoryComparison(category) === normalizedValue,
    ) || null
  )
}

export function getCanonicalCategoryLabel(value) {
  const normalizedValue = collapseCategoryWhitespace(value)

  if (!normalizedValue) {
    return ''
  }

  return getCanonicalAllowedInventoryCategory(normalizedValue) || normalizedValue
}

export function isUncategorizedCategory(value) {
  return normalizeCategoryComparison(value) ===
    normalizeCategoryComparison(UNCATEGORIZED_CATEGORY_LABEL)
}

export function resolvePreferredCategoryLabel(...candidates) {
  const resolvedCandidates = candidates
    .map((candidate) => getCanonicalCategoryLabel(candidate))
    .filter(Boolean)

  const preferredCandidate = resolvedCandidates.find(
    (candidate) => !isUncategorizedCategory(candidate),
  )

  return preferredCandidate || resolvedCandidates[0] || UNCATEGORIZED_CATEGORY_LABEL
}
