import api from '../../../shared/api/apiClient.js'
import { resolveInventoryRecordIds } from '../../../shared/utils/inventoryRecords.js'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseDataEnabled,
  supabaseRuntime,
  supabaseTables,
  supabaseViews,
} from '../../../shared/api/supabaseClient.js'
import { inventoryItems } from '../../../shared/mocks/mockData.js'
import { shortDate } from '../../../shared/utils/formatters.js'
import {
  clearCachedResourceByPrefix,
  getCachedResource,
  setCachedResource,
} from '../../../shared/utils/resourceCache.js'
import {
  getStoredInventoryItems,
  saveStoredInventoryItems,
} from '../../../shared/utils/storage.js'

const LOW_STOCK_THRESHOLD = 10
const NEAR_EXPIRY_DAYS = 30
const INVENTORY_CACHE_PREFIX = 'inventory:'
const INVENTORY_CACHE_TTL_MS = 60 * 1000

function cloneInventoryValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function getInventoryCacheKey(options = {}) {
  const branchId =
    options.branchId != null && String(options.branchId).trim() !== ''
      ? String(options.branchId).trim()
      : 'all'

  return `${INVENTORY_CACHE_PREFIX}${isSupabaseDataEnabled ? 'supabase' : 'local'}:${branchId}`
}

function invalidateInventoryQueryCaches() {
  clearCachedResourceByPrefix(INVENTORY_CACHE_PREFIX)
  clearCachedResourceByPrefix('products:')
  clearCachedResourceByPrefix('reports:')
}

export function getCachedInventoryItems(options = {}) {
  return getCachedResource(
    getInventoryCacheKey(options),
    INVENTORY_CACHE_TTL_MS,
  )
}

function ensureLocalInventoryItems() {
  const storedInventoryItems = getStoredInventoryItems()

  if (storedInventoryItems.length > 0) {
    return storedInventoryItems
  }

  const seededInventoryItems = cloneInventoryValue(inventoryItems)
  saveStoredInventoryItems(seededInventoryItems)
  return seededInventoryItems
}

async function fetchLegacyInventoryItems() {
  try {
    const response = await api.get('/inventory')
    const rows = response.data?.items || response.data
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function sanitizeInventoryText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function resolveSupabaseBranchId(values = {}, fallbackItem = {}) {
  const candidateBranchId =
    values.branch_id ?? values.branchId ?? fallbackItem.branch_id ?? fallbackItem.branchId

  if (candidateBranchId != null && String(candidateBranchId).trim() !== '') {
    return Number(candidateBranchId)
  }

  const candidateBranchName =
    values.branch ??
    values.branch_name ??
    values.branchName ??
    fallbackItem.branch ??
    fallbackItem.branch_name ??
    fallbackItem.branchName

  if (String(candidateBranchName || '').trim() === 'Dollar') {
    return 2
  }

  if (String(candidateBranchName || '').trim() === 'Sta. Lucia') {
    return 1
  }

  return Number(supabaseRuntime.defaultBranchId || 1)
}

function resolveSupabaseProductBranch(values = {}, fallbackItem = {}) {
  const candidateBranchName =
    values.branch ??
    values.branch_name ??
    values.branchName ??
    fallbackItem.branch ??
    fallbackItem.branch_name ??
    fallbackItem.branchName

  if (candidateBranchName != null && String(candidateBranchName).trim() !== '') {
    return sanitizeInventoryText(candidateBranchName)
  }

  return resolveSupabaseBranchId(values, fallbackItem) === 2
    ? 'Dollar'
    : 'Sta. Lucia'
}

function buildSupabaseProductPayload(values, fallbackItem = {}) {
  return {
    branch: resolveSupabaseProductBranch(values, fallbackItem),
    category: sanitizeInventoryText(
      values.category_name ?? values.category ?? fallbackItem.category_name ?? fallbackItem.category,
    ) || 'Uncategorized',
    product_name: sanitizeInventoryText(
      values.product_name ?? values.product ?? fallbackItem.product_name ?? fallbackItem.product,
    ),
    net_weight: sanitizeInventoryText(
      values.unit ?? values.net_weight ?? fallbackItem.unit ?? fallbackItem.net_weight,
    ),
    price: Number(values.price ?? fallbackItem.price ?? 0),
    stock_quantity: Number(
      values.stock_quantity ?? values.stock ?? fallbackItem.stock_quantity ?? 0,
    ),
    expiration_date:
      sanitizeInventoryText(
        values.expiry_date ??
          values.expiration_date ??
          fallbackItem.expiry_date ??
          fallbackItem.expiration_date,
      ) || null,
  }
}

async function fetchSupabaseInventoryItems(options = {}) {
  const supabase = getSupabaseClient()
  let query = supabase
    .from(supabaseViews.inventoryCatalog)
    .select('*')
    .eq('is_active', true)
    .order('product_name', { ascending: true })

  if (options.branchId != null && String(options.branchId).trim() !== '') {
    query = query.eq('branch_id', Number(options.branchId))
  }

  const { data, error } = await query

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Inventory records could not be loaded from Supabase.',
    )
  }

  return Array.isArray(data) ? data : []
}

async function fetchSupabaseInventoryItemById(itemId) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(supabaseViews.inventoryCatalog)
    .select('*')
    .eq('inventory_item_id', itemId)
    .maybeSingle()

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to load the selected inventory item from Supabase.',
    )
  }

  return data || null
}

async function fetchSupabaseInventoryItemByProductId(productId) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(supabaseViews.inventoryCatalog)
    .select('*')
    .eq('product_id', Number(productId))
    .maybeSingle()

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to load the selected inventory item from Supabase.',
    )
  }

  return data || null
}

async function fetchSupabaseProductById(productId) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(supabaseTables.products)
    .select('*')
    .eq('id', Number(productId))
    .maybeSingle()

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to load the selected product from Supabase.',
    )
  }

  return data || null
}

async function findSupabaseProductConflict(values, fallbackItem = {}, excludeProductId = null) {
  const supabase = getSupabaseClient()
  const payload = buildSupabaseProductPayload(values, fallbackItem)
  let query = supabase
    .from(supabaseTables.products)
    .select('*')
    .eq('branch', payload.branch)
    .eq('category', payload.category)
    .eq('product_name', payload.product_name)
    .eq('net_weight', payload.net_weight)

  if (excludeProductId != null) {
    query = query.neq('id', Number(excludeProductId))
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to match the product record in Supabase.',
    )
  }

  return data || null
}

async function getSupabaseInventoryContext(itemId) {
  const currentItem =
    (await fetchSupabaseInventoryItemById(itemId)) ||
    (await fetchSupabaseInventoryItemByProductId(itemId))

  if (!currentItem) {
    return null
  }

  return {
    currentItem,
    ...resolveInventoryRecordIds(currentItem),
  }
}

export async function getInventoryItems(options = {}) {
  const cachedInventoryResponse = getCachedInventoryItems(options)

  if (cachedInventoryResponse) {
    return cachedInventoryResponse
  }

  if (isSupabaseDataEnabled) {
    return setCachedResource(getInventoryCacheKey(options), {
      items: (await fetchSupabaseInventoryItems(options)).map((item) =>
        normalizeInventoryItem(item),
      ),
    })
  }

  const legacyInventoryItems = await fetchLegacyInventoryItems()

  if (legacyInventoryItems.length > 0) {
    return setCachedResource(getInventoryCacheKey(options), {
      items: legacyInventoryItems.map((item) => normalizeInventoryItem(item)),
    })
  }

  return setCachedResource(getInventoryCacheKey(options), {
    items: ensureLocalInventoryItems().map((item) => normalizeInventoryItem(item)),
  })
}

export function normalizeInventoryItem(item) {
  const productName = item.product_name || item.product || ''
  const categoryName = item.category_name || item.category || ''
  const stockQuantity = Number(item.stock_quantity ?? item.stock ?? 0)
  const reorderLevel = Number(item.reorder_level ?? LOW_STOCK_THRESHOLD)
  const expiryDate =
    item.expiry_date || item.expiration_date || item.expiry || ''
  const unitValue = item.unit || item.unit_label || item.net_weight || ''
  const priceValue = Number(
    item.price ?? item.selling_price ?? item.default_price ?? item.selling_price ?? 0,
  )

  return {
    id: item.inventory_item_id ?? item.id,
    inventory_item_id: item.inventory_item_id ?? item.id,
    product_id: item.product_id ?? item.productId ?? item.id ?? null,
    branch_id: item.branch_id ?? null,
    branch_name: item.branch_name || 'Unassigned Branch',
    category_id: item.category_id ?? null,
    category_name: categoryName,
    product_name: productName,
    stock_quantity: stockQuantity,
    unit: unitValue,
    price: Number.isFinite(priceValue) ? priceValue : 0,
    expiry_date: expiryDate,
    reorder_level: reorderLevel,
    days_to_expiry: expiryDate ? getDaysToExpiry(expiryDate) : null,
    legacy_stock_text: item.legacy_stock_text ?? null,
  }
}

export function createInventoryItemRecord(values, existingItems = []) {
  const nextId =
    existingItems.reduce(
      (maxId, item) => Math.max(maxId, Number(item.id) || 0),
      0,
    ) + 1

  return normalizeInventoryItem({
    id: nextId,
    product_id: nextId,
    branch_id: values.branch_id ?? null,
    branch_name: values.branch_name || 'Unassigned Branch',
    category_name: sanitizeInventoryText(values.category_name ?? values.category),
    product_name: sanitizeInventoryText(values.product_name ?? values.product),
    stock_quantity: Number(values.stock_quantity ?? values.stock ?? 0),
    unit: sanitizeInventoryText(values.unit),
    price: Number(values.price || 0),
    expiry_date: sanitizeInventoryText(values.expiry_date ?? values.expiration_date),
    reorder_level: Number(values.reorder_level ?? LOW_STOCK_THRESHOLD),
  })
}

export async function createInventoryItem(values, existingItems = []) {
  if (isSupabaseDataEnabled) {
    const conflictingProduct = await findSupabaseProductConflict(values)

    if (conflictingProduct) {
      throw new Error(
        'This product already exists for the selected branch. Use Stock In or Edit instead.',
      )
    }

    const supabase = getSupabaseClient()
    const payload = buildSupabaseProductPayload(values)
    const { data, error } = await supabase
      .from(supabaseTables.products)
      .insert(payload)
      .select()
      .single()

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to create the product in Supabase.',
      )
    }

    const createdItem = await fetchSupabaseInventoryItemByProductId(data.id)
    invalidateInventoryQueryCaches()
    return normalizeInventoryItem(createdItem || data)
  }

  const createdItem = createInventoryItemRecord(values, existingItems)
  persistInventoryItems([createdItem, ...existingItems])
  invalidateInventoryQueryCaches()
  return createdItem
}

export async function updateInventoryItem(itemId, values) {
  if (isSupabaseDataEnabled) {
    const inventoryContext = await getSupabaseInventoryContext(itemId)
    const currentItem = inventoryContext?.currentItem
    const productId = inventoryContext?.productId

    if (!currentItem || productId == null) {
      throw new Error('The selected inventory item could not be found.')
    }

    const conflictingProduct = await findSupabaseProductConflict(
      values,
      currentItem,
      productId,
    )

    if (
      conflictingProduct &&
      Number(conflictingProduct.id) !== Number(productId)
    ) {
      throw new Error(
        'That product already exists in the selected branch. Use Stock In or Edit the existing record instead.',
      )
    }

    const supabase = getSupabaseClient()
    const payload = buildSupabaseProductPayload(values, currentItem)
    const { error } = await supabase
      .from(supabaseTables.products)
      .update(payload)
      .eq('id', productId)

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to update this inventory item in Supabase.',
      )
    }

    const updatedItem = await fetchSupabaseInventoryItemByProductId(productId)
    invalidateInventoryQueryCaches()
    return normalizeInventoryItem(updatedItem)
  }

  const currentItems = ensureLocalInventoryItems().map((item) =>
    normalizeInventoryItem(item),
  )
  const selectedItem = currentItems.find(
    (item) => String(item.id) === String(itemId),
  )

  if (!selectedItem) {
    throw new Error('The selected inventory item could not be found.')
  }

  const updatedItem = normalizeInventoryItem({
    id: selectedItem.id,
    ...values,
  })

  persistInventoryItems(
    currentItems.map((item) =>
      String(item.id) === String(itemId) ? updatedItem : item,
    ),
  )

  invalidateInventoryQueryCaches()
  return updatedItem
}

export async function updateInventoryStock(itemId, quantityValue, options = {}) {
  const numericQuantity = Number(quantityValue || 0)
  const mode = options.mode === 'adjust-stock' ? 'adjust-stock' : 'stock-in'

  if (!Number.isFinite(numericQuantity)) {
    throw new Error('Enter a valid stock quantity to continue.')
  }

  if (isSupabaseDataEnabled) {
    const inventoryContext = await getSupabaseInventoryContext(itemId)
    const productId = inventoryContext?.productId
    const currentInventoryItem = inventoryContext?.currentItem
    const supabase = getSupabaseClient()
    const currentProduct = await fetchSupabaseProductById(productId)

    if (!currentProduct || productId == null || !currentInventoryItem) {
      throw new Error('The selected inventory item could not be found.')
    }

    const nextStockQuantity =
      mode === 'adjust-stock'
        ? Math.max(0, numericQuantity)
        : Math.max(0, Number(currentProduct.stock_quantity || 0) + numericQuantity)

    const { error } = await supabase
      .from(supabaseTables.products)
      .update({ stock_quantity: nextStockQuantity })
      .eq('id', productId)

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to update stock quantity in Supabase.',
      )
    }

    const updatedItem = await fetchSupabaseInventoryItemByProductId(productId)
    invalidateInventoryQueryCaches()
    return normalizeInventoryItem(updatedItem)
  }

  const currentItems = ensureLocalInventoryItems().map((item) =>
    normalizeInventoryItem(item),
  )
  const selectedItem = currentItems.find(
    (item) => String(item.id) === String(itemId),
  )

  if (!selectedItem) {
    throw new Error('The selected inventory item could not be found.')
  }

  const updatedItem = normalizeInventoryItem({
    ...selectedItem,
    stock_quantity:
      mode === 'adjust-stock'
        ? Math.max(0, numericQuantity)
        : Math.max(0, Number(selectedItem.stock_quantity) + numericQuantity),
  })

  persistInventoryItems(
    currentItems.map((item) =>
      String(item.id) === String(itemId) ? updatedItem : item,
    ),
  )

  invalidateInventoryQueryCaches()
  return updatedItem
}

export async function removeInventoryItem(itemId) {
  if (isSupabaseDataEnabled) {
    const inventoryContext = await getSupabaseInventoryContext(itemId)
    const productId = inventoryContext?.productId
    const supabase = getSupabaseClient()
    const currentProduct = await fetchSupabaseProductById(productId)

    if (!currentProduct || productId == null) {
      throw new Error('The selected inventory item could not be found.')
    }

    const { error: legacyInventoryDeleteError } = await supabase
      .from(supabaseTables.inventoryItems)
      .delete()
      .eq('product_id', Number(productId))

    if (legacyInventoryDeleteError) {
      throw createSupabaseServiceError(
        legacyInventoryDeleteError,
        'Unable to clear legacy inventory records for this product.',
      )
    }

    const { error } = await supabase
      .from(supabaseTables.products)
      .delete()
      .eq('id', Number(productId))

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to remove this inventory item from Supabase.',
      )
    }

    invalidateInventoryQueryCaches()
    return normalizeInventoryItem(currentProduct)
  }

  const currentItems = ensureLocalInventoryItems().map((item) =>
    normalizeInventoryItem(item),
  )
  const selectedItem = currentItems.find(
    (item) => String(item.id) === String(itemId),
  )

  if (!selectedItem) {
    throw new Error('The selected inventory item could not be found.')
  }

  persistInventoryItems(
    currentItems.filter((item) => String(item.id) !== String(itemId)),
  )

  invalidateInventoryQueryCaches()
  return selectedItem
}

export function normalizeInventoryProductName(value) {
  return sanitizeInventoryText(value).toLowerCase()
}

function normalizeInventoryMatchValue(value) {
  return sanitizeInventoryText(value).toLowerCase()
}

export function hasInventoryCatalogConflict(
  values = {},
  existingItems = [],
  currentItemId = null,
) {
  const normalizedProductName = normalizeInventoryMatchValue(
    values.product_name ?? values.product,
  )
  const normalizedCategoryName = normalizeInventoryMatchValue(
    values.category_name ?? values.category,
  )
  const normalizedUnit = normalizeInventoryMatchValue(
    values.unit ?? values.net_weight,
  )
  const normalizedBranchId = values.branch_id ?? values.branchId ?? null

  if (!normalizedProductName || !normalizedCategoryName || !normalizedUnit) {
    return false
  }

  return existingItems.some((item) => (
    Number(item.id) !== Number(currentItemId) &&
    normalizeInventoryMatchValue(item.product_name) === normalizedProductName &&
    normalizeInventoryMatchValue(item.category_name) === normalizedCategoryName &&
    normalizeInventoryMatchValue(item.unit) === normalizedUnit &&
    (normalizedBranchId == null ||
      Number(item.branch_id ?? normalizedBranchId) === Number(normalizedBranchId))
  ))
}

export function persistInventoryItems(items = []) {
  const normalizedItems = items.map((item) => normalizeInventoryItem(item))

  if (!isSupabaseDataEnabled) {
    saveStoredInventoryItems(normalizedItems)
  }

  invalidateInventoryQueryCaches()

  return normalizedItems
}

function findInventoryItemMatch(inventoryItem, soldItem) {
  const soldProductId =
    soldItem.product_id ?? soldItem.productId ?? soldItem.id ?? null

  if (soldProductId != null && inventoryItem.product_id != null) {
    return String(inventoryItem.product_id) === String(soldProductId)
  }

  const soldItemName = soldItem.item_name || soldItem.name || ''

  return (
    normalizeInventoryProductName(inventoryItem.product_name) ===
    normalizeInventoryProductName(soldItemName)
  )
}

export async function applySaleToInventory(soldItems = [], options = {}) {
  const inventoryTrackedItems = Array.isArray(soldItems)
    ? soldItems.filter((soldItem) => soldItem?.is_service_fee !== true)
    : []

  if (inventoryTrackedItems.length === 0) {
    const inventoryResponse = await getInventoryItems(options)
    return inventoryResponse.items || inventoryResponse
  }

  if (isSupabaseDataEnabled) {
    if (!supabaseRuntime.inventoryManagedOnSale) {
      const inventoryResponse = await getInventoryItems(options)
      return inventoryResponse.items || inventoryResponse
    }

    const branchId =
      options.branchId != null && String(options.branchId).trim() !== ''
        ? Number(options.branchId)
        : Number(supabaseRuntime.defaultBranchId || 1)

    const supabase = getSupabaseClient()

    await Promise.all(
      inventoryTrackedItems.map(async (soldItem) => {
        const productId =
          soldItem.product_id ?? soldItem.productId ?? soldItem.id ?? null

        if (productId == null) {
          return
        }

        const currentProduct = await fetchSupabaseProductById(productId)

        if (!currentProduct) {
          return
        }

        const productBranchId =
          resolveSupabaseBranchId({ branch: currentProduct.branch }, currentProduct)

        if (Number(productBranchId) !== Number(branchId)) {
          return
        }

        const nextStockQuantity = Math.max(
          0,
          Number(currentProduct.stock_quantity || 0) - Number(soldItem.quantity || 0),
        )

        const { error: updateError } = await supabase
          .from(supabaseTables.products)
          .update({ stock_quantity: nextStockQuantity })
          .eq('id', productId)

        if (updateError) {
          throw createSupabaseServiceError(
            updateError,
            'Unable to sync branch inventory after checkout.',
          )
        }
      }),
    )

    invalidateInventoryQueryCaches()
    const inventoryResponse = await getInventoryItems({ branchId })
    return inventoryResponse.items || inventoryResponse
  }

  const inventoryResponse = await getInventoryItems(options)
  const currentInventoryItems = inventoryResponse.items || inventoryResponse
  const nextInventoryItems = currentInventoryItems.map((inventoryItem) => {
    const matchedSaleItem = inventoryTrackedItems.find((soldItem) =>
      findInventoryItemMatch(inventoryItem, soldItem),
    )

    if (!matchedSaleItem) {
      return inventoryItem
    }

    return normalizeInventoryItem({
      ...inventoryItem,
      stock_quantity: Math.max(
        0,
        Number(inventoryItem.stock_quantity) - Number(matchedSaleItem.quantity || 0),
      ),
    })
  })

  persistInventoryItems(nextInventoryItems)
  invalidateInventoryQueryCaches()
  return nextInventoryItems
}

function getDaysToExpiry(value) {
  const today = new Date()
  const expiryDate = new Date(value)
  const msUntilExpiry = expiryDate.getTime() - today.getTime()

  return Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24))
}

export function formatInventoryDate(value) {
  return shortDate(value)
}

export function isLowStock(item) {
  return Number(item.stock_quantity) <= Number(item.reorder_level)
}

export function isNearExpiry(item) {
  return item.days_to_expiry != null && Number(item.days_to_expiry) <= NEAR_EXPIRY_DAYS
}

export function getInventoryStatus(item) {
  if (isLowStock(item) && isNearExpiry(item)) {
    return { label: 'Low Stock & Near Expiry', tone: 'critical' }
  }

  if (isLowStock(item)) {
    return { label: 'Low Stock', tone: 'warning' }
  }

  if (isNearExpiry(item)) {
    return { label: 'Near Expiry', tone: 'attention' }
  }

  return { label: 'Normal', tone: 'normal' }
}
