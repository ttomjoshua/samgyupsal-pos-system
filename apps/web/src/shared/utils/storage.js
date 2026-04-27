import { getCanonicalCategoryLabel } from './categoryUtils.js'

const CATEGORY_STORAGE_KEY = 'samyupsal-pos-custom-categories'
const USER_KEY = 'samyupsal_user'
const LOCAL_BRANCHES_KEY = 'samyupsal_local_branches'
const LOCAL_ACCOUNTS_KEY = 'samyupsal_local_accounts'
const SALES_HISTORY_KEY = 'samyupsal_sales_history'
const INVENTORY_ITEMS_KEY = 'samyupsal_inventory_items'

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage)
}

function readStorageValue(storageKey, fallbackValue) {
  if (!canUseStorage()) {
    return fallbackValue
  }

  const rawValue = window.localStorage.getItem(storageKey)

  if (!rawValue) {
    return fallbackValue
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    return fallbackValue
  }
}

function writeStorageValue(storageKey, value) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value))
}

function removeStorageValue(storageKey) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(storageKey)
}

function readSessionValue(storageKey, fallbackValue) {
  if (!canUseSessionStorage()) {
    return fallbackValue
  }

  const rawValue = window.sessionStorage.getItem(storageKey)

  if (!rawValue) {
    return fallbackValue
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    return fallbackValue
  }
}

function writeSessionValue(storageKey, value) {
  if (!canUseSessionStorage()) {
    return
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(value))
}

function removeSessionValue(storageKey) {
  if (!canUseSessionStorage()) {
    return
  }

  window.sessionStorage.removeItem(storageKey)
}

function normalizeCategoryName(categoryName) {
  return getCanonicalCategoryLabel(categoryName)
}

export function readSessionStorageValue(storageKey, fallbackValue) {
  return readSessionValue(storageKey, fallbackValue)
}

export function writeSessionStorageValue(storageKey, value) {
  writeSessionValue(storageKey, value)
}

export function removeSessionStorageValue(storageKey) {
  removeSessionValue(storageKey)
}

export function getStoredCategories() {
  const storedCategories = readStorageValue(CATEGORY_STORAGE_KEY, [])
  return Array.isArray(storedCategories) ? storedCategories : []
}

export function saveStoredCategories(categories) {
  writeStorageValue(CATEGORY_STORAGE_KEY, categories)
}

export function getStoredLocalBranches() {
  const branches = readStorageValue(LOCAL_BRANCHES_KEY, [])
  return Array.isArray(branches) ? branches : []
}

export function saveStoredLocalBranches(branches) {
  writeStorageValue(LOCAL_BRANCHES_KEY, branches)
}

export function getStoredLocalAccounts() {
  const accounts = readStorageValue(LOCAL_ACCOUNTS_KEY, [])
  return Array.isArray(accounts) ? accounts : []
}

export function saveStoredLocalAccounts(accounts) {
  writeStorageValue(LOCAL_ACCOUNTS_KEY, accounts)
}

export function getStoredSalesHistory() {
  const salesHistory = readStorageValue(SALES_HISTORY_KEY, [])
  return Array.isArray(salesHistory) ? salesHistory : []
}

export function saveStoredSalesHistory(salesHistory) {
  writeStorageValue(SALES_HISTORY_KEY, salesHistory)
}

export function getStoredInventoryItems() {
  const inventoryItems = readStorageValue(INVENTORY_ITEMS_KEY, [])
  return Array.isArray(inventoryItems) ? inventoryItems : []
}

export function saveStoredInventoryItems(inventoryItems) {
  writeStorageValue(INVENTORY_ITEMS_KEY, inventoryItems)
}

export function mergeProductAndStoredCategories(products) {
  const productCategories = products
    .map((product) => normalizeCategoryName(product.category || ''))
    .filter(Boolean)

  const storedCategories = getStoredCategories().map((category) =>
    normalizeCategoryName(category),
  )

  return Array.from(new Set([...productCategories, ...storedCategories]))
}

export function prepareCategoryName(categoryName) {
  return normalizeCategoryName(categoryName)
}

export function saveUser(user) {
  writeStorageValue(USER_KEY, user)
}

export function getSavedUser() {
  const user = readStorageValue(USER_KEY, null)

  if (!user || typeof user !== 'object') {
    return null
  }

  return user
}

export function clearSavedUser() {
  removeStorageValue(USER_KEY)
}

export function getStoredAuthSession() {
  const user = getSavedUser()
  return user ? { user } : null
}

export function saveStoredAuthSession(session) {
  const user = session?.user ?? session

  if (!user || typeof user !== 'object') {
    clearSavedUser()
    return
  }

  saveUser(user)
}

export function clearStoredAuthSession() {
  clearSavedUser()
}
