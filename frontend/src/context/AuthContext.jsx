/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useMemo, useState } from 'react'
import {
  getAuthenticatedUserFromSession,
  getCurrentSession,
  loginUser,
  logoutUser,
  subscribeToAuthChanges,
} from '../services/authService'
import { isSupabaseAuthEnabled } from '../services/supabaseClient'
import { normalizeMockUser } from '../services/userService'
import { getRoleLabel, isAdminUser, isEmployeeUser, normalizeRoleKey } from '../utils/permissions'
import {
  clearSavedUser,
  getSavedUser,
  saveUser,
} from '../utils/storage'

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
          setAuthError('')
          return
        }

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

        setUser(null)
        clearSavedUser()
        setAuthError(
          error.response?.data?.message ||
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

        setUser(null)
        clearSavedUser()
        setAuthError(
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
  }, [])

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
      setUser(null)
      clearSavedUser()
    } finally {
      setIsAuthenticating(false)
      setIsAuthReady(true)
    }
  }

  const value = useMemo(
    () => ({
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
    }),
    [authError, isAuthenticating, isAuthReady, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
