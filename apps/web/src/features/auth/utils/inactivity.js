import {
  isAdminUser,
  normalizeRoleKey,
} from '../../../shared/utils/permissions.js'

const runtimeEnv = import.meta.env || {}

export const DEFAULT_ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000
export const DEFAULT_EMPLOYEE_IDLE_TIMEOUT_MS = 30 * 60 * 1000
export const ACTIVITY_PERSIST_THROTTLE_MS = 15 * 1000
export const ACTIVITY_RESET_THROTTLE_MS = 1000
export const INACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'scroll',
  'touchstart',
]

const INACTIVITY_LOGOUT_MESSAGES = {
  admin:
    'For security, your administrator session ended after 15 minutes of inactivity. Sign in again to continue.',
  employee:
    'For security, your employee session ended after 30 minutes of inactivity. Sign in again to continue.',
}

function parsePositiveTimeout(value, fallbackValue) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallbackValue
  }

  return Math.floor(numericValue)
}

const configuredIdleTimeouts = {
  admin: parsePositiveTimeout(
    runtimeEnv.VITE_ADMIN_IDLE_TIMEOUT_MS,
    DEFAULT_ADMIN_IDLE_TIMEOUT_MS,
  ),
  employee: parsePositiveTimeout(
    runtimeEnv.VITE_EMPLOYEE_IDLE_TIMEOUT_MS,
    DEFAULT_EMPLOYEE_IDLE_TIMEOUT_MS,
  ),
}

export function getConfiguredIdleTimeouts() {
  return configuredIdleTimeouts
}

export function getIdleTimeoutMs(user) {
  return isAdminUser(user)
    ? configuredIdleTimeouts.admin
    : configuredIdleTimeouts.employee
}

export function getInactivityLogoutMessage(user) {
  return isAdminUser(user)
    ? INACTIVITY_LOGOUT_MESSAGES.admin
    : INACTIVITY_LOGOUT_MESSAGES.employee
}

export function isInactivityLogoutMessage(value) {
  return Object.values(INACTIVITY_LOGOUT_MESSAGES).includes(
    String(value || '').trim(),
  )
}

export function parseActivityTimestamp(value) {
  const timestamp = Number(value)

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null
  }

  return timestamp
}

export function getActivityStorageKey(user) {
  const roleKey = normalizeRoleKey(user)
  const userId = String(user?.id || '').trim() || 'anonymous'

  return `samgyupsal:last-activity-at:${roleKey}:${userId}`
}
