import api from './api'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseRuntime,
  supabaseTables,
  supabaseViews,
} from './supabaseClient'
import { inventoryItems } from '../mockData'
import { shortDate } from '../utils/formatters'
import {
  getStoredInventoryItems,
  saveStoredInventoryItems,
} from '../utils/storage'

const LOW_STOCK_THRESHOLD = 10
const NEAR_EXPIRY_DAYS = 30

function cloneInventoryValue(value) {
  return JSON.parse(JSON.stringify(value))
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

function buildCategorySlug(value) {
  return sanitizeInventoryText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveSupabaseBranchId(values = {}, fallbackItem = {}) {
  const candidateBranchId =
    values.branch_id ?? values.branchId ?? fallbackItem.branch_id ?? fallbackItem.branchId

  if (candidateBranchId != null && String(candidateBranchId).trim() !== '') {
    return Number(candidateBranchId)
  }

  return Number(supabaseRuntime.defaultBranchId || 1)
}

function buildSupabaseProductPayload(values, categoryId) {
  return {
    category_id: Number(categoryId),
    product_name: sanitizeInventoryText(values.product_name ?? values.product),
    unit_label: sanitizeInventoryText(values.unit),
    default_price: Number(values.price || 0),
    legacy_price_text:
      values.price != null && String(values.price).trim() !== ''
        ? String(values.price).trim()
        : null,
    is_active: true,
  }
}

function buildSupabaseInventoryPayload(values, productId, fallbackItem = {}) {
  return {
    branch_id: resolveSupabaseBranchId(values, fallbackItem),
    product_id: Number(productId),
    selling_price: Number(values.price || 0),
    stock_quantity: Number(values.stock_quantity ?? values.stock ?? 0),
    reorder_level: Number(values.reorder_level ?? fallbackItem.reorder_level ?? LOW_STOCK_THRESHOLD),
    expiration_date:
      sanitizeInventoryText(
        values.expiry_date ?? values.expiration_date ?? fallbackItem.expiry_date,
      ) || null,
    legacy_stock_text:
      values.stock_quantity != null && String(values.stock_quantity).trim() !== ''
        ? String(values.stock_quantity).trim()
        : fallbackItem.legacy_stock_text ?? null,
    is_active: true,
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

async function ensureSupabaseCategory(categoryName) {
  const supabase = getSupabaseClient()
  const normalizedCategoryName = sanitizeInventoryText(categoryName)
  const categorySlug = buildCategorySlug(normalizedCategoryName)

  if (!normalizedCategoryName || !categorySlug) {
    throw new Error('A category name is required before saving this product.')
  }

  const { data: existingCategory, error: existingCategoryError } = await supabase
    .from(supabaseTables.categories)
    .select('*')
    .eq('slug', categorySlug)
    .maybeSingle()

  if (existingCategoryError) {
    throw createSupabaseServiceError(
      existingCategoryError,
      'Unable to check the category list in Supabase.',
    )
  }

  if (existingCategory) {
    return existingCategory
  }

  const { data: createdCategory, error: createCategoryError } = await supabase
    .from(supabaseTables.categories)
    .insert({
      name: normalizedCategoryName,
      slug: categorySlug,
    })
    .select()
    .single()

  if (createCategoryError) {
    throw createSupabaseServiceError(
      createCategoryError,
      'Unable to create this category in Supabase.',
    )
  }

  return createdCategory
}

async function findSupabaseProduct(productName, unitLabel, categoryId) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(supabaseTables.products)
    .select('*')
    .eq('category_id', Number(categoryId))
    .eq('product_name', sanitizeInventoryText(productName))
    .eq('unit_label', sanitizeInventoryText(unitLabel))
    .maybeSingle()

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to match the product catalog record in Supabase.',
    )
  }

  return data || null
}

async function ensureSupabaseProduct(values, categoryId) {
  const supabase = getSupabaseClient()
  const payload = buildSupabaseProductPayload(values, categoryId)
  const existingProduct = await findSupabaseProduct(
    payload.product_name,
    payload.unit_label,
    payload.category_id,
  )

  if (existingProduct) {
    return existingProduct
  }

  const { data, error } = await supabase
    .from(supabaseTables.products)
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to create the product catalog record in Supabase.',
    )
  }

  return data
}

async function findSupabaseInventoryItem(branchId, productId) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(supabaseTables.inventoryItems)
    .select('*')
    .eq('branch_id', Number(branchId))
    .eq('product_id', Number(productId))
    .maybeSingle()

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to check the branch inventory record in Supabase.',
    )
  }

  return data || null
}

export async function getInventoryItems(options = {}) {
  if (isSupabaseConfigured) {
    return {
      items: (await fetchSupabaseInventoryItems(options)).map((item) =>
        normalizeInventoryItem(item),
      ),
    }
  }

  const legacyInventoryItems = await fetchLegacyInventoryItems()

  if (legacyInventoryItems.length > 0) {
    return {
      items: legacyInventoryItems.map((item) => normalizeInventoryItem(item)),
    }
  }

  return {
    items: ensureLocalInventoryItems().map((item) => normalizeInventoryItem(item)),
  }
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
  if (isSupabaseConfigured) {
    const category = await ensureSupabaseCategory(values.category_name ?? values.category)
    const product = await ensureSupabaseProduct(values, category.id)
    const branchId = resolveSupabaseBranchId(values)
    const existingInventoryItem = await findSupabaseInventoryItem(branchId, product.id)

    if (existingInventoryItem) {
      throw new Error(
        'This product already exists for the selected branch. Use Stock In or Edit instead.',
      )
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseTables.inventoryItems)
      .insert(buildSupabaseInventoryPayload(values, product.id))
      .select()
      .single()

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to create the inventory item in Supabase.',
      )
    }

    const createdItem = await fetchSupabaseInventoryItemById(data.id)
    return normalizeInventoryItem(createdItem || data)
  }

  const createdItem = createInventoryItemRecord(values, existingItems)
  persistInventoryItems([createdItem, ...existingItems])
  return createdItem
}

export async function updateInventoryItem(itemId, values) {
  if (isSupabaseConfigured) {
    const currentItem = await fetchSupabaseInventoryItemById(itemId)

    if (!currentItem) {
      throw new Error('The selected inventory item could not be found.')
    }

    const category = await ensureSupabaseCategory(values.category_name ?? values.category)
    const targetProduct = await ensureSupabaseProduct(values, category.id)
    const targetBranchId = resolveSupabaseBranchId(values, currentItem)
    const conflictingInventoryItem = await findSupabaseInventoryItem(
      targetBranchId,
      targetProduct.id,
    )

    if (
      conflictingInventoryItem &&
      Number(conflictingInventoryItem.id) !== Number(itemId)
    ) {
      throw new Error(
        'That product already exists in the selected branch. Use Stock In or Edit the existing record instead.',
      )
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from(supabaseTables.inventoryItems)
      .update(buildSupabaseInventoryPayload(values, targetProduct.id, currentItem))
      .eq('id', itemId)

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to update this inventory item in Supabase.',
      )
    }

    const updatedItem = await fetchSupabaseInventoryItemById(itemId)
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

  return updatedItem
}

export async function updateInventoryStock(itemId, quantityDelta) {
  const numericDelta = Number(quantityDelta || 0)

  if (!Number.isFinite(numericDelta) || numericDelta === 0) {
    throw new Error('Enter a valid stock quantity to continue.')
  }

  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient()
    const { data: currentItem, error: currentItemError } = await supabase
      .from(supabaseTables.inventoryItems)
      .select('*')
      .eq('id', itemId)
      .single()

    if (currentItemError) {
      throw createSupabaseServiceError(
        currentItemError,
        'Unable to load the selected inventory item from Supabase.',
      )
    }

    const nextStockQuantity = Math.max(
      0,
      Number(currentItem.stock_quantity || 0) + numericDelta,
    )

    const { error } = await supabase
      .from(supabaseTables.inventoryItems)
      .update({ stock_quantity: nextStockQuantity })
      .eq('id', itemId)

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to update stock quantity in Supabase.',
      )
    }

    const updatedItem = await fetchSupabaseInventoryItemById(itemId)
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
    stock_quantity: Math.max(
      0,
      Number(selectedItem.stock_quantity) + numericDelta,
    ),
  })

  persistInventoryItems(
    currentItems.map((item) =>
      String(item.id) === String(itemId) ? updatedItem : item,
    ),
  )

  return updatedItem
}

export function normalizeInventoryProductName(value) {
  return sanitizeInventoryText(value).toLowerCase()
}

export function hasInventoryNameConflict(
  productName,
  existingItems = [],
  currentItemId = null,
) {
  const normalizedProductName = normalizeInventoryProductName(productName)

  if (!normalizedProductName) {
    return false
  }

  return existingItems.some((item) => (
    Number(item.id) !== Number(currentItemId) &&
    normalizeInventoryProductName(item.product_name) === normalizedProductName
  ))
}

export function persistInventoryItems(items = []) {
  const normalizedItems = items.map((item) => normalizeInventoryItem(item))

  if (!isSupabaseConfigured) {
    saveStoredInventoryItems(normalizedItems)
  }

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
  if (!Array.isArray(soldItems) || soldItems.length === 0) {
    const inventoryResponse = await getInventoryItems(options)
    return inventoryResponse.items || inventoryResponse
  }

  if (isSupabaseConfigured) {
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
      soldItems.map(async (soldItem) => {
        const productId =
          soldItem.product_id ?? soldItem.productId ?? soldItem.id ?? null

        if (productId == null) {
          return
        }

        const { data: currentItem, error: currentItemError } = await supabase
          .from(supabaseTables.inventoryItems)
          .select('*')
          .eq('branch_id', branchId)
          .eq('product_id', productId)
          .maybeSingle()

        if (currentItemError) {
          throw createSupabaseServiceError(
            currentItemError,
            'Unable to find the branch inventory record for this sale.',
          )
        }

        if (!currentItem) {
          return
        }

        const nextStockQuantity = Math.max(
          0,
          Number(currentItem.stock_quantity || 0) - Number(soldItem.quantity || 0),
        )

        const { error: updateError } = await supabase
          .from(supabaseTables.inventoryItems)
          .update({ stock_quantity: nextStockQuantity })
          .eq('id', currentItem.id)

        if (updateError) {
          throw createSupabaseServiceError(
            updateError,
            'Unable to sync branch inventory after checkout.',
          )
        }
      }),
    )

    const inventoryResponse = await getInventoryItems({ branchId })
    return inventoryResponse.items || inventoryResponse
  }

  const inventoryResponse = await getInventoryItems(options)
  const currentInventoryItems = inventoryResponse.items || inventoryResponse
  const nextInventoryItems = currentInventoryItems.map((inventoryItem) => {
    const matchedSaleItem = soldItems.find((soldItem) =>
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
