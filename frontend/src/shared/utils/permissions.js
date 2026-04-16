export const ROLE_ADMIN = 'admin'
export const ROLE_EMPLOYEE = 'employee'

const ROLE_LABELS = {
  [ROLE_ADMIN]: 'Administrator',
  [ROLE_EMPLOYEE]: 'Employee',
}

export const APP_NAV_ITEMS = [
  {
    key: 'dashboard',
    to: '/app/dashboard',
    label: 'Dashboard',
    allowedRoles: [ROLE_ADMIN],
  },
  {
    key: 'pos',
    to: '/app/pos',
    label: 'POS',
    allowedRoles: [ROLE_ADMIN, ROLE_EMPLOYEE],
  },
  {
    key: 'inventory',
    to: '/app/inventory',
    label: 'Inventory',
    allowedRoles: [ROLE_ADMIN],
  },
  {
    key: 'reports',
    to: '/app/reports',
    label: 'Reports',
    allowedRoles: [ROLE_ADMIN],
  },
  {
    key: 'products',
    to: '/app/products',
    label: 'Products',
    allowedRoles: [ROLE_ADMIN],
  },
  {
    key: 'users',
    to: '/app/users',
    label: 'Users',
    allowedRoles: [ROLE_ADMIN],
  },
]

export function normalizeRoleKey(value) {
  const rawValue =
    typeof value === 'object' && value !== null
      ? value.roleKey || value.role
      : value

  const normalizedValue = String(rawValue || '')
    .trim()
    .toLowerCase()

  if (
    normalizedValue === ROLE_ADMIN ||
    normalizedValue === 'administrator'
  ) {
    return ROLE_ADMIN
  }

  if (
    normalizedValue === ROLE_EMPLOYEE ||
    normalizedValue === 'employee' ||
    normalizedValue === 'cashier'
  ) {
    return ROLE_EMPLOYEE
  }

  return ROLE_EMPLOYEE
}

export function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRoleKey(role)] || ROLE_LABELS[ROLE_EMPLOYEE]
}

export function isAdminUser(user) {
  return normalizeRoleKey(user) === ROLE_ADMIN
}

export function isEmployeeUser(user) {
  return normalizeRoleKey(user) === ROLE_EMPLOYEE
}

export function canAccessAppSection(user, sectionKey) {
  const section = APP_NAV_ITEMS.find((item) => item.key === sectionKey)

  if (!section || !user) {
    return false
  }

  return section.allowedRoles.includes(normalizeRoleKey(user))
}

export function getVisibleNavItems(user) {
  return APP_NAV_ITEMS.filter((item) => canAccessAppSection(user, item.key))
}

export function getDefaultAppPath(user) {
  const firstAccessibleItem = getVisibleNavItems(user)[0]
  return firstAccessibleItem?.to || '/'
}
