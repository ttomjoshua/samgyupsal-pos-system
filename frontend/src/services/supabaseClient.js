import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const isSupabaseAuthEnabled =
  isSupabaseConfigured &&
  String(import.meta.env.VITE_SUPABASE_AUTH_ENABLED || 'true')
    .trim()
    .toLowerCase() === 'true'

export const supabaseTables = {
  products: import.meta.env.VITE_SUPABASE_PRODUCTS_TABLE || 'products',
  categories: import.meta.env.VITE_SUPABASE_CATEGORIES_TABLE || 'categories',
  inventoryItems:
    import.meta.env.VITE_SUPABASE_INVENTORY_TABLE || 'inventory_items',
  sales: import.meta.env.VITE_SUPABASE_SALES_TABLE || 'sales',
  saleItems: import.meta.env.VITE_SUPABASE_SALE_ITEMS_TABLE || 'sale_items',
  branches: import.meta.env.VITE_SUPABASE_BRANCHES_TABLE || 'branches',
  profiles: import.meta.env.VITE_SUPABASE_PROFILES_TABLE || 'profiles',
}

export const supabaseViews = {
  productCatalog:
    import.meta.env.VITE_SUPABASE_PRODUCTS_VIEW || 'product_catalog_view',
  inventoryCatalog:
    import.meta.env.VITE_SUPABASE_INVENTORY_VIEW || 'inventory_catalog_view',
}

export const supabaseEdgeFunctions = {
  adminCreateUser:
    import.meta.env.VITE_SUPABASE_ADMIN_CREATE_USER_FUNCTION || 'admin-create-user',
}

export const supabaseRuntime = {
  inventoryManagedOnSale:
    String(import.meta.env.VITE_SUPABASE_SYNC_INVENTORY_ON_SALE || 'false')
      .trim()
      .toLowerCase() === 'true',
  defaultBranchId: Number(import.meta.env.VITE_SUPABASE_DEFAULT_BRANCH_ID || 1),
}

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

function createStructuredServiceError(message, cause = null) {
  const error = new Error(message)
  error.response = {
    data: {
      message,
    },
  }

  if (cause) {
    error.cause = cause
  }

  return error
}

export function createSupabaseServiceError(error, fallbackMessage) {
  return createStructuredServiceError(error?.message || fallbackMessage, error)
}

export function createSupabaseConfigError(context = 'Supabase service') {
  return createStructuredServiceError(
    `${context} is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the frontend environment first.`,
  )
}

export function getSupabaseClient() {
  if (!supabase) {
    throw createSupabaseConfigError()
  }

  return supabase
}
