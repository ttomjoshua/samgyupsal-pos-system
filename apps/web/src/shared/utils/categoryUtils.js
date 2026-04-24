export const UNCATEGORIZED_CATEGORY_LABEL = 'Uncategorized'

export const STANDARD_PRODUCT_CATEGORIES = [
  'Meat',
  'Drinks',
  'Condiments',
  'Frozen Goods',
  'Noodles',
  'Rice / Sides',
  'Vegetables',
  'Dairy',
  'Snacks',
  'Desserts',
  'Coffee / Tea',
  'Packaging',
  'Supplies',
  UNCATEGORIZED_CATEGORY_LABEL,
]

export const LEGACY_INVENTORY_CATEGORIES = [
  'Korean Noodles',
  'Samgyup bowl meat',
  'Samgyup meat',
  'Seaweed',
]

export const ALLOWED_INVENTORY_CATEGORIES = [
  ...STANDARD_PRODUCT_CATEGORIES,
  ...LEGACY_INVENTORY_CATEGORIES,
]

function collapseCategoryWhitespace(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeBarcodeValue(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
}

export function isValidBarcodeValue(value) {
  const normalizedValue = normalizeBarcodeValue(value)

  if (!normalizedValue) {
    return true
  }

  return /^[A-Za-z0-9._/-]{1,64}$/.test(normalizedValue)
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

export function getStandardProductCategoryLabel(value) {
  const categoryLabel = getCanonicalCategoryLabel(value)
  const normalizedCategory = normalizeCategoryComparison(categoryLabel)

  if (!normalizedCategory) {
    return ''
  }

  if (normalizedCategory === 'korean noodles') {
    return 'Noodles'
  }

  if (normalizedCategory === 'seaweed') {
    return 'Snacks'
  }

  if (
    normalizedCategory === 'samgyup meat' ||
    normalizedCategory === 'samgyup bowl meat'
  ) {
    return 'Meat'
  }

  return STANDARD_PRODUCT_CATEGORIES.find(
    (category) => normalizeCategoryComparison(category) === normalizedCategory,
  ) || ''
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
