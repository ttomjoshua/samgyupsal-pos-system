/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useState } from 'react'
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
import { isInactivityLogoutMessage } from '../../features/auth/utils/inactivity'

export const AuthContext = createContext(null)

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
  const [user, setUser] = useState(() =>
    isSupabaseAuthEnabled ? null : normalizeAuthenticatedUser(getSavedUser()),
  )
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseAuthEnabled)
  const [authError, setAuthError] = useState('')

  const clearAuthenticatedState = useCallback((message = '') => {
    setUser(null)
    clearSavedUser()
    setAuthError(message)
  }, [])

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

  const logout = async (options = {}) => {
    const normalizedOptions =
      typeof options === 'string'
        ? { message: options }
        : options || {}
    const logoutMessage = String(normalizedOptions.message || '').trim()
    const suppressErrors = normalizedOptions.suppressErrors === true

    setIsAuthenticating(true)

    if (!logoutMessage) {
      setAuthError('')
    }

    try {
      await logoutUser()
      clearAuthenticatedState(logoutMessage)
    } catch (error) {
      if (suppressErrors) {
        console.error('Unable to finish the forced logout flow:', error)
        clearAuthenticatedState(logoutMessage)
        return
      }

      throw error
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
