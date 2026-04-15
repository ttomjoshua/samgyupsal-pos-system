import api from './api'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseViews,
} from './supabaseClient'

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

  return {
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

  return {
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
  }
}

export async function getProducts(options = {}) {
  if (isSupabaseConfigured) {
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
        'Unable to load products from Supabase.',
      )
    }

    return extractProductArray(data)
      .map(normalizeInventoryProduct)
      .filter((product) => Boolean(product.id))
  }

  const response = await api.get('/products')
  return extractProductArray(response.data)
    .map(normalizeInventoryProduct)
    .filter((product) => Boolean(product.id))
}

export async function getProductCatalog() {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseViews.productCatalog)
      .select('*')
      .eq('is_active', true)
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

  const response = await api.get('/products')
  return extractProductArray(response.data)
    .map(normalizeCatalogProduct)
    .filter((product) => Boolean(product.id))
}
