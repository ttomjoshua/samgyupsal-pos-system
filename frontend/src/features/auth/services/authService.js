import {
  findAccountByUsername,
  normalizeMockUser,
  normalizeUsername,
} from '../../users/services/userService'
import { getProfileForAuthUser } from '../../users/services/profileService'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseAuthEnabled,
} from '../../../shared/api/supabaseClient'
import {
  claimCurrentSessionLock,
  clearCurrentSupabaseSession,
  releaseCurrentSessionLock,
  SESSION_CONFLICT_CODE,
} from './sessionLockService'

function createLoginError(message, cause = null) {
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

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizeSupabaseAuthError(error, fallbackMessage) {
  if (error?.code === SESSION_CONFLICT_CODE) {
    return error
  }

  const rawMessage = String(error?.message || '').trim().toLowerCase()

  if (rawMessage.includes('invalid login credentials')) {
    return createLoginError('Incorrect email or password. Please try again.', error)
  }

  if (rawMessage.includes('email not confirmed')) {
    return createLoginError(
      'This email is not confirmed yet. Check your inbox or ask the administrator.',
      error,
    )
  }

  return createLoginError(error?.message || fallbackMessage, error)
}

function assertActiveAuthenticatedUser(user) {
  if (!user) {
    throw createLoginError('Unable to start the session with this account.')
  }

  if (String(user.status || '').trim().toLowerCase() !== 'active') {
    throw createLoginError(
      'This employee account is inactive. Please contact the administrator.',
    )
  }

  return user
}

export async function getAuthenticatedUserFromSession(session) {
  const authUser = session?.user ?? session

  if (!authUser?.id) {
    return null
  }

  if (isSupabaseAuthEnabled) {
    const profileUser = await getProfileForAuthUser(authUser)
    return assertActiveAuthenticatedUser(profileUser)
  }

  return assertActiveAuthenticatedUser(normalizeMockUser(authUser))
}

export async function loginUser(payload = {}) {
  if (isSupabaseAuthEnabled) {
    const supabase = getSupabaseClient()
    const email = normalizeEmail(payload.email)
    const password = payload.password || ''

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      const authenticatedUser = await getAuthenticatedUserFromSession(data.session)
      await claimCurrentSessionLock()

      return {
        session: data.session,
        user: authenticatedUser,
      }
    } catch (error) {
      try {
        await clearCurrentSupabaseSession()
      } catch (signOutError) {
        console.error('Unable to clean up Supabase session after login failure:', signOutError)
      }

      throw normalizeSupabaseAuthError(
        error,
        'Unable to sign in with Supabase right now.',
      )
    }
  }

  const normalizedUsername = normalizeUsername(payload.username)
  const password = payload.password || ''
  const matchedAccount = findAccountByUsername(normalizedUsername)

  if (!matchedAccount || matchedAccount.password !== password) {
    throw createLoginError('Incorrect username or password. Please try again.')
  }

  if (matchedAccount.status !== 'active') {
    throw createLoginError(
      'This employee account is inactive. Please contact the administrator.',
    )
  }

  return {
    user: normalizeMockUser(matchedAccount),
  }
}

export async function getCurrentSession() {
  if (!isSupabaseAuthEnabled) {
    return null
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    return data.session
  } catch (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to restore the Supabase session.',
    )
  }
}

export function subscribeToAuthChanges(callback) {
  if (!isSupabaseAuthEnabled) {
    return () => {}
  }

  const supabase = getSupabaseClient()
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })

  return () => {
    data.subscription.unsubscribe()
  }
}

export async function logoutUser() {
  if (!isSupabaseAuthEnabled) {
    return { ok: true }
  }

  try {
    try {
      await releaseCurrentSessionLock()
    } catch (error) {
      console.error('Unable to release the active session lock:', error)
    }

    await clearCurrentSupabaseSession()

    return { ok: true }
  } catch (error) {
    throw normalizeSupabaseAuthError(
      error,
      'Unable to sign out from Supabase right now.',
    )
  }
}
