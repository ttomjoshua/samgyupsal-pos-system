export const INVENTORY_FILTER_ALL = 'all'
export const INVENTORY_FILTER_LOW_STOCK = 'low-stock'
export const INVENTORY_FILTER_EXPIRY_DATE = 'expiry-date'

function normalizeFilterText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function isInventoryItemLowStock(item) {
  return Number(item?.stock_quantity) <= Number(item?.reorder_level)
}

export function hasInventoryExpiryDate(item) {
  return String(item?.expiry_date || '').trim() !== ''
}

export function getInventoryExpirySortValue(item) {
  const parsedDate = Date.parse(item?.expiry_date || '')
  return Number.isFinite(parsedDate) ? parsedDate : Number.MAX_SAFE_INTEGER
}

export function filterInventoryItemsByBranch(items = [], branchId = '') {
  const normalizedBranchId = String(branchId || '').trim()

  if (!normalizedBranchId) {
    return [...items]
  }

  return items.filter(
    (item) => String(item?.branch_id ?? item?.branchId ?? '').trim() === normalizedBranchId,
  )
}

export function filterInventoryItemsByStatus(
  items = [],
  status = INVENTORY_FILTER_ALL,
) {
  switch (status) {
    case INVENTORY_FILTER_LOW_STOCK:
      return items.filter((item) => isInventoryItemLowStock(item))
    case INVENTORY_FILTER_EXPIRY_DATE:
      return items.filter((item) => hasInventoryExpiryDate(item))
    case INVENTORY_FILTER_ALL:
    default:
      return [...items]
  }
}

export function sortInventoryItems(items = [], status = INVENTORY_FILTER_ALL) {
  return [...items].sort((leftItem, rightItem) => {
    if (status === INVENTORY_FILTER_EXPIRY_DATE) {
      const expiryDifference =
        getInventoryExpirySortValue(leftItem) - getInventoryExpirySortValue(rightItem)

      if (expiryDifference !== 0) {
        return expiryDifference
      }
    }

    const nameComparison = normalizeFilterText(leftItem?.product_name).localeCompare(
      normalizeFilterText(rightItem?.product_name),
    )

    if (nameComparison !== 0) {
      return nameComparison
    }

    return getInventoryExpirySortValue(leftItem) - getInventoryExpirySortValue(rightItem)
  })
}

export function getInventoryCategoryOptions(items = []) {
  return [...new Set(
    items
      .map((item) => String(item?.category_name || '').trim())
      .filter(Boolean),
  )].sort((leftValue, rightValue) => leftValue.localeCompare(rightValue))
}

export function filterInventoryItemsByCategory(items = [], category = 'all') {
  const normalizedCategory = normalizeFilterText(category)

  if (!normalizedCategory || normalizedCategory === INVENTORY_FILTER_ALL) {
    return [...items]
  }

  return items.filter(
    (item) => normalizeFilterText(item?.category_name) === normalizedCategory,
  )
}

export function resolveInventoryFilterResults({
  items = [],
  branchId = '',
  status = INVENTORY_FILTER_ALL,
  category = INVENTORY_FILTER_ALL,
} = {}) {
  const branchItems = filterInventoryItemsByBranch(items, branchId)
  const statusItems = sortInventoryItems(
    filterInventoryItemsByStatus(branchItems, status),
    status,
  )
  const categoryOptions = getInventoryCategoryOptions(statusItems)
  const resolvedCategory =
    categoryOptions.find(
      (option) => normalizeFilterText(option) === normalizeFilterText(category),
    ) || INVENTORY_FILTER_ALL

  return {
    branchItems,
    statusItems,
    categoryOptions,
    resolvedCategory,
    filteredItems: filterInventoryItemsByCategory(statusItems, resolvedCategory),
  }
}
