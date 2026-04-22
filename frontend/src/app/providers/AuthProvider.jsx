/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import {
  getAuthenticatedUserFromSession,
  getCurrentSession,
  loginUser,
  logoutUser,
  subscribeToAuthChanges,
} from '../../features/auth/services/authService'
import { isSupabaseAuthEnabled } from '../../shared/api/supabaseClient'
import { normalizeMockUser } from '../../features/users/services/userService'
import { getRoleLabel, isAdminUser, isEmployeeUser, normalizeRoleKey } from '../../shared/utils/permissions'
import {
  clearSavedUser,
  getSavedUser,
  saveUser,
} from '../../shared/utils/storage'
import {
  clearCurrentSupabaseSession,
  SESSION_CONFLICT_MESSAGE,
  isSessionConflictError,
  isSessionConflictMessage,
  validateCurrentSessionLock,
} from '../../features/auth/services/sessionLockService'

export const AuthContext = createContext(null)

const ACTIVITY_STORAGE_KEY = 'samgyupsal:last-activity-at'
const ACTIVITY_SYNC_THROTTLE_MS = 15000
const IDLE_CHECK_INTERVAL_MS = 15000
const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000
const EMPLOYEE_IDLE_TIMEOUT_MS = 30 * 60 * 1000
const INACTIVITY_EVENTS = [
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

function getIdleTimeoutMs(user) {
  return isAdminUser(user) ? ADMIN_IDLE_TIMEOUT_MS : EMPLOYEE_IDLE_TIMEOUT_MS
}

function getInactivityLogoutMessage(user) {
  return isAdminUser(user)
    ? INACTIVITY_LOGOUT_MESSAGES.admin
    : INACTIVITY_LOGOUT_MESSAGES.employee
}

function isInactivityLogoutMessage(value) {
  return Object.values(INACTIVITY_LOGOUT_MESSAGES).includes(
    String(value || '').trim(),
  )
}

function parseActivityTimestamp(value) {
  const timestamp = Number(value)

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null
  }

  return timestamp
}

function normalizeAuthenticatedUser(payload, fallbackIdentifier) {
  const candidateUser = payload?.user && typeof payload.user === 'object'
    ? payload.user
    : payload

  if (!candidateUser) {
    return null
  }

  if (isSupabaseAuthEnabled) {
    const roleKey = normalizeRoleKey(candidateUser)

    return {
      id: candidateUser.id,
      email: String(candidateUser.email || fallbackIdentifier || '')
        .trim()
        .toLowerCase(),
      username: String(candidateUser.username || '').trim().toLowerCase(),
      name: String(candidateUser.name || fallbackIdentifier || 'Unnamed User').trim(),
      roleKey,
      role: candidateUser.role || getRoleLabel(roleKey),
      branchId: candidateUser.branchId ?? null,
      branchName:
        candidateUser.branchName ||
        (roleKey === 'admin' ? 'All Branches' : 'Unassigned Branch'),
      status: candidateUser.status || 'active',
    }
  }

  return (
    normalizeMockUser(candidateUser) || {
      id: null,
      username: fallbackIdentifier?.trim() || '',
      name: fallbackIdentifier?.trim() || 'Admin User',
      roleKey: 'admin',
      role: 'Administrator',
      branchId: null,
      branchName: 'All Branches',
      status: 'active',
    }
  )
}

export function AuthProvider({ children }) {
  const lastActivityAtRef = useRef(Date.now())
  const lastActivitySyncAtRef = useRef(0)
  const isIdleLogoutInProgressRef = useRef(false)
  const [user, setUser] = useState(() =>
    isSupabaseAuthEnabled ? null : normalizeAuthenticatedUser(getSavedUser()),
  )
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseAuthEnabled)
  const [authError, setAuthError] = useState('')

  const resetInactivityTracking = useCallback(() => {
    lastActivityAtRef.current = Date.now()
    lastActivitySyncAtRef.current = 0
    isIdleLogoutInProgressRef.current = false

    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.removeItem(ACTIVITY_STORAGE_KEY)
    } catch {
      // Ignore storage cleanup errors.
    }
  }, [])

  const clearAuthenticatedState = useCallback((message = '') => {
    setUser(null)
    clearSavedUser()
    resetInactivityTracking()
    setAuthError(message)
  }, [resetInactivityTracking])

  useEffect(() => {
    if (!isSupabaseAuthEnabled) {
      return undefined
    }

    let isMounted = true

    const syncSession = async (session) => {
      try {
        if (!session?.user) {
          if (!isMounted) {
            return
          }

          setUser(null)
          clearSavedUser()
          setAuthError((currentError) =>
            isSessionConflictMessage(currentError) ||
            isInactivityLogoutMessage(currentError)
              ? currentError
              : ''
          )
          return
        }

        await validateCurrentSessionLock()
        const authenticatedUser = await getAuthenticatedUserFromSession(session)

        if (!isMounted) {
          return
        }

        setUser(authenticatedUser)
        saveUser(authenticatedUser)
        setAuthError('')
      } catch (error) {
        console.error('Failed to restore Supabase session:', error)

        if (!isMounted) {
          return
        }

        if (isSessionConflictError(error)) {
          try {
            await clearCurrentSupabaseSession()
          } catch (signOutError) {
            console.error('Unable to clear the blocked Supabase session:', signOutError)
          }
        }

        clearAuthenticatedState(
          isSessionConflictError(error)
            ? SESSION_CONFLICT_MESSAGE
            : error.response?.data?.message ||
            error.message ||
              'Unable to restore the current session.',
        )
      } finally {
        if (isMounted) {
          setIsAuthReady(true)
        }
      }
    }

    const initializeAuth = async () => {
      try {
        setIsAuthReady(false)
        const session = await getCurrentSession()
        await syncSession(session)
      } catch (error) {
        console.error('Failed to initialize Supabase auth:', error)

        if (!isMounted) {
          return
        }

        clearAuthenticatedState(
          error.response?.data?.message ||
            error.message ||
            'Unable to initialize Supabase authentication.',
        )
        setIsAuthReady(true)
      }
    }

    initializeAuth()

    const unsubscribe = subscribeToAuthChanges((_event, session) => {
      window.setTimeout(() => {
        if (!isMounted) {
          return
        }

        setIsAuthReady(false)
        void syncSession(session)
      }, 0)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [clearAuthenticatedState])

  useEffect(() => {
    if (!isSupabaseAuthEnabled || !user?.id) {
      return undefined
    }

    let isMounted = true

    const validateSession = async () => {
      try {
        const session = await getCurrentSession()

        if (!isMounted || !session?.user) {
          return
        }

        await validateCurrentSessionLock()
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (!isSessionConflictError(error)) {
          console.error('Unable to refresh the session lock heartbeat:', error)
          return
        }

        try {
          await clearCurrentSupabaseSession()
        } catch (signOutError) {
          console.error('Unable to clear the replaced Supabase session:', signOutError)
        }

        clearAuthenticatedState(
          SESSION_CONFLICT_MESSAGE,
        )
        setIsAuthReady(true)
      }
    }

    const heartbeatInterval = window.setInterval(() => {
      void validateSession()
    }, 60000)

    return () => {
      isMounted = false
      window.clearInterval(heartbeatInterval)
    }
  }, [clearAuthenticatedState, user?.id])

  useEffect(() => {
    if (!user?.id) {
      return undefined
    }

    let isMounted = true
    const idleTimeoutMs = getIdleTimeoutMs(user)
    const inactivityMessage = getInactivityLogoutMessage(user)

    const persistActivityTimestamp = (timestamp) => {
      if (typeof window === 'undefined') {
        return
      }

      try {
        window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(timestamp))
        lastActivitySyncAtRef.current = timestamp
      } catch {
        // Ignore storage sync errors.
      }
    }

    const syncActivityFromStorage = () => {
      if (typeof window === 'undefined') {
        return null
      }

      try {
        const storedTimestamp = parseActivityTimestamp(
          window.localStorage.getItem(ACTIVITY_STORAGE_KEY),
        )

        if (
          storedTimestamp != null &&
          storedTimestamp > lastActivityAtRef.current
        ) {
          lastActivityAtRef.current = storedTimestamp
          lastActivitySyncAtRef.current = storedTimestamp
        }

        return storedTimestamp
      } catch {
        return null
      }
    }

    const markActivity = (timestamp = Date.now()) => {
      lastActivityAtRef.current = timestamp

      if (
        timestamp - lastActivitySyncAtRef.current >=
        ACTIVITY_SYNC_THROTTLE_MS
      ) {
        persistActivityTimestamp(timestamp)
      }
    }

    const handleIdleLogout = async () => {
      if (!isMounted || isIdleLogoutInProgressRef.current) {
        return
      }

      isIdleLogoutInProgressRef.current = true

      try {
        await logoutUser()
      } catch (error) {
        console.error('Unable to sign out the inactive session:', error)
      }

      if (!isMounted) {
        return
      }

      clearAuthenticatedState(inactivityMessage)
      setIsAuthReady(true)
    }

    const checkForIdleSession = () => {
      syncActivityFromStorage()

      if (Date.now() - lastActivityAtRef.current < idleTimeoutMs) {
        return
      }

      void handleIdleLogout()
    }

    const initialActivityAt =
      syncActivityFromStorage() ?? Date.now()

    lastActivityAtRef.current = initialActivityAt
    persistActivityTimestamp(initialActivityAt)
    checkForIdleSession()

    const handleActivity = () => {
      markActivity(Date.now())
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForIdleSession()

        if (!isIdleLogoutInProgressRef.current) {
          markActivity(Date.now())
        }
      }
    }

    const handleWindowFocus = () => {
      checkForIdleSession()

      if (!isIdleLogoutInProgressRef.current) {
        markActivity(Date.now())
      }
    }

    const handleStorage = (event) => {
      if (event.key !== ACTIVITY_STORAGE_KEY) {
        return
      }

      const nextActivityAt = parseActivityTimestamp(event.newValue)

      if (
        nextActivityAt != null &&
        nextActivityAt > lastActivityAtRef.current
      ) {
        lastActivityAtRef.current = nextActivityAt
        lastActivitySyncAtRef.current = nextActivityAt
      }
    }

    INACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('storage', handleStorage)

    const idleInterval = window.setInterval(
      checkForIdleSession,
      IDLE_CHECK_INTERVAL_MS,
    )

    return () => {
      isMounted = false
      window.clearInterval(idleInterval)
      INACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('storage', handleStorage)
    }
  }, [clearAuthenticatedState, user])

  const login = async (credentials) => {
    setIsAuthenticating(true)
    setAuthError('')

    try {
      const result = await loginUser(credentials)
      const authenticatedUser = normalizeAuthenticatedUser(
        result,
        credentials?.email || credentials?.username,
      )

      if (!authenticatedUser) {
        throw new Error('Unable to start the session with this account.')
      }

      setUser(authenticatedUser)
      saveUser(authenticatedUser)
      return authenticatedUser
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Unable to sign in with this account.'
      setAuthError(message)
      throw error
    } finally {
      setIsAuthenticating(false)
      setIsAuthReady(true)
    }
  }

  const logout = async () => {
    setIsAuthenticating(true)
    setAuthError('')

    try {
      await logoutUser()
      clearAuthenticatedState('')
    } finally {
      setIsAuthenticating(false)
      setIsAuthReady(true)
    }
  }

  const value = {
    user,
    session: user ? { user } : null,
    isAuthenticated: Boolean(user),
    isAdmin: isAdminUser(user),
    isEmployee: isEmployeeUser(user),
    isAuthenticating,
    isAuthReady,
    authError,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
