import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseDataEnabled,
  supabaseTables,
  supabaseViews,
} from '../../../shared/api/supabaseClient'
import { products as mockProducts } from '../../../shared/mocks/mockData'
import { getInventoryItems } from '../../inventory/services/inventoryService'
import { deriveProductSellability } from '../../../shared/utils/productAvailability'

function extractProductArray(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.products)) {
    return payload.products
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  if (Array.isArray(payload?.data?.products)) {
    return payload.data.products
  }

  return []
}

function normalizeCatalogProduct(product, index) {
  const productId = product.product_id ?? product.id ?? product._id ?? product.productId
  const categoryName =
    product.category_name ||
    product.categories?.name ||
    product.category ||
    product.category_name ||
    'Uncategorized'
  const branchName = product.branch_name || product.branch || 'Unassigned Branch'
  const branchId =
    product.branch_id ??
    (branchName === 'Dollar' ? 2 : branchName === 'Sta. Lucia' ? 1 : null)

  const normalizedProduct = {
    id: productId ? String(productId) : null,
    branchId,
    branchName,
    name:
      product.name ||
      product.product_name ||
      product.productName ||
      product.itemName ||
      `Product ${index + 1}`,
    category: categoryName,
    price: Number(
      product.default_price ??
        product.price ??
        product.selling_price ??
        product.sellingPrice ??
        product.salePrice ??
        product.unitPrice ??
        0,
    ),
    unit: product.unit_label || product.net_weight || '',
    is_active: product.is_active ?? product.isActive ?? true,
  }
  const sellability = deriveProductSellability(normalizedProduct)

  return {
    ...normalizedProduct,
    ...sellability,
  }
}

function normalizeInventoryProduct(product, index) {
  const productId = product.product_id ?? product.id ?? product._id ?? product.productId
  const categoryName =
    product.category_name ||
    product.categories?.name ||
    product.category ||
    'Uncategorized'
  const branchName = product.branch_name || product.branch || 'Unassigned Branch'
  const branchId =
    product.branch_id ??
    (branchName === 'Dollar' ? 2 : branchName === 'Sta. Lucia' ? 1 : null)

  const normalizedProduct = {
    id: productId ? String(productId) : null,
    inventoryItemId: product.inventory_item_id ?? product.inventoryItemId ?? null,
    branchId,
    branchName,
    name:
      product.name ||
      product.product_name ||
      product.productName ||
      product.itemName ||
      `Product ${index + 1}`,
    category: categoryName,
    price: Number(
      product.price ??
        product.selling_price ??
        product.default_price ??
        product.salePrice ??
        product.unitPrice ??
        0,
    ),
    unit: product.unit_label || product.net_weight || '',
    stockQuantity: Number(product.stock_quantity ?? 0),
    is_active: product.is_active ?? product.isActive ?? true,
  }
  const sellability = deriveProductSellability(normalizedProduct)

  return {
    ...normalizedProduct,
    ...sellability,
  }
}

function getFallbackBranchName(branchId) {
  return Number(branchId) === 2 ? 'Dollar' : 'Sta. Lucia'
}

async function getLocalCatalogSource(options = {}) {
  try {
    const inventoryResponse = await getInventoryItems(options)
    const inventoryItems = inventoryResponse.items || inventoryResponse

    if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
      return inventoryItems
    }
  } catch {
    // Fall through to the seeded demo catalog.
  }

  return mockProducts.map((product) => ({
    id: product.id,
    product_id: product.id,
    inventory_item_id: product.id,
    branch_id: options.branchId ? Number(options.branchId) : 1,
    branch_name: getFallbackBranchName(options.branchId),
    product_name: product.name,
    category_name: product.category,
    price: Number(product.price || 0),
    unit_label: '',
    stock_quantity: 25,
  }))
}

export async function getProducts(options = {}) {
  if (isSupabaseDataEnabled) {
    const supabase = getSupabaseClient()
    let query = supabase
      .from(supabaseViews.inventoryCatalog)
      .select('*')
      .order('product_name', { ascending: true })

    if (options.branchId != null && String(options.branchId).trim() !== '') {
      query = query.eq('branch_id', Number(options.branchId))
    }

    const { data, error } = await query

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to load products from Supabase.',
      )
    }

    return extractProductArray(data)
      .map(normalizeInventoryProduct)
      .filter((product) => Boolean(product.id))
  }

  const localCatalog = await getLocalCatalogSource(options)
  return extractProductArray(localCatalog)
    .map(normalizeInventoryProduct)
    .filter((product) => Boolean(product.id))
}

export async function getProductCatalog() {
  if (isSupabaseDataEnabled) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseViews.productCatalog)
      .select('*')
      .order('product_name', { ascending: true })

    if (error) {
      throw createSupabaseServiceError(
        error,
        'Unable to load the product catalog from Supabase.',
      )
    }

    return extractProductArray(data)
      .map(normalizeCatalogProduct)
      .filter((product) => Boolean(product.id))
  }

  const localCatalog = await getLocalCatalogSource()
  return extractProductArray(localCatalog)
    .map(normalizeCatalogProduct)
    .filter((product) => Boolean(product.id))
}

export async function renameProductCategory(currentCategoryName, nextCategoryName) {
  if (!isSupabaseDataEnabled) {
    throw new Error(
      'Renaming product-backed categories requires the active Supabase catalog.',
    )
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(supabaseTables.products)
    .update({ category: nextCategoryName })
    .eq('category', currentCategoryName)
    .select('id')

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to rename this product category in Supabase.',
    )
  }

  return Array.isArray(data) ? data.length : 0
}

export async function removeProductCategory(categoryName) {
  if (!isSupabaseDataEnabled) {
    throw new Error(
      'Removing product-backed categories requires the active Supabase catalog.',
    )
  }

  if (String(categoryName || '').trim() === 'Uncategorized') {
    throw new Error('The Uncategorized category cannot be removed.')
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(supabaseTables.products)
    .update({ category: 'Uncategorized' })
    .eq('category', categoryName)
    .select('id')

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to remove this product category from Supabase.',
    )
  }

  return Array.isArray(data) ? data.length : 0
}
