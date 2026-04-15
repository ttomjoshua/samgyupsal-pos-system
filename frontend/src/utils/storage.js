const CATEGORY_STORAGE_KEY = 'samyupsal-pos-custom-categories'
const USER_KEY = 'samyupsal_user'
const MOCK_BRANCHES_KEY = 'samyupsal_mock_branches'
const MOCK_ACCOUNTS_KEY = 'samyupsal_mock_accounts'
const SALES_HISTORY_KEY = 'samyupsal_sales_history'
const INVENTORY_ITEMS_KEY = 'samyupsal_inventory_items'
const STEP_8_TO_11_RESET_KEY = 'samyupsal_step_8_to_11_reset_v1'

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
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

function normalizeCategoryName(categoryName) {
  return categoryName.trim().replace(/\s+/g, ' ')
}

export function getStoredCategories() {
  const storedCategories = readStorageValue(CATEGORY_STORAGE_KEY, [])
  return Array.isArray(storedCategories) ? storedCategories : []
}

export function saveStoredCategories(categories) {
  writeStorageValue(CATEGORY_STORAGE_KEY, categories)
}

export function getStoredMockBranches() {
  const branches = readStorageValue(MOCK_BRANCHES_KEY, [])
  return Array.isArray(branches) ? branches : []
}

export function saveStoredMockBranches(branches) {
  writeStorageValue(MOCK_BRANCHES_KEY, branches)
}

export function getStoredMockAccounts() {
  const accounts = readStorageValue(MOCK_ACCOUNTS_KEY, [])
  return Array.isArray(accounts) ? accounts : []
}

export function saveStoredMockAccounts(accounts) {
  writeStorageValue(MOCK_ACCOUNTS_KEY, accounts)
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

export function clearStep8To11DemoState() {
  removeStorageValue(SALES_HISTORY_KEY)
  removeStorageValue(INVENTORY_ITEMS_KEY)
}

export function runStep8To11DemoResetOnce() {
  const resetState = readStorageValue(STEP_8_TO_11_RESET_KEY, null)

  if (resetState?.completed) {
    return false
  }

  clearStep8To11DemoState()
  writeStorageValue(STEP_8_TO_11_RESET_KEY, {
    completed: true,
    clearedAt: new Date().toISOString(),
  })
  return true
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
