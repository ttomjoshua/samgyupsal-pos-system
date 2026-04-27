import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseAuthEnabled,
  supabaseRpc,
} from '../../../shared/supabase/client.js'

export const SESSION_CONFLICT_CODE = 'SESSION_LOCK_CONFLICT'
export const SESSION_CONFLICT_MESSAGE =
  'This account is already signed in on another device. Sign out there first before trying again.'

const SESSION_CONFLICT_PATTERNS = [
  'already signed in on another device',
  'already active on another device',
  'already logged in on another device',
  'already signed in elsewhere',
  'already active elsewhere',
  'account already in use',
  'account is already in use',
  'session lock conflict',
  'active session already exists',
]

function normalizeMessage(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function isSessionConflictMessage(message) {
  const normalizedMessage = normalizeMessage(message)

  if (!normalizedMessage) {
    return false
  }

  return SESSION_CONFLICT_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern)
  )
}

function createSessionConflictError(cause = null) {
  const error = new Error(SESSION_CONFLICT_MESSAGE)
  error.code = SESSION_CONFLICT_CODE
  error.response = {
    data: {
      message: SESSION_CONFLICT_MESSAGE,
    },
  }

  if (cause) {
    error.cause = cause
  }

  return error
}

function collectSessionLockErrorMessages(error) {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.response?.data?.message,
    error?.response?.data?.error,
    error?.cause?.message,
    error?.cause?.details,
    error?.cause?.hint,
  ].filter(Boolean)
}

async function invokeSessionLockRpc(rpcName) {
  if (!isSupabaseAuthEnabled) {
    return true
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc(rpcName)

  if (error) {
    if (isSessionConflictError(error)) {
      throw createSessionConflictError(error)
    }

    throw createSupabaseServiceError(
      error,
      'Unable to verify the current login session.',
    )
  }

  return data === true
}

export async function claimCurrentSessionLock() {
  const isAllowed = await invokeSessionLockRpc(supabaseRpc.claimSessionLock)

  if (!isAllowed) {
    throw createSessionConflictError()
  }

  return true
}

export async function validateCurrentSessionLock() {
  const isAllowed = await invokeSessionLockRpc(supabaseRpc.validateSessionLock)

  if (!isAllowed) {
    throw createSessionConflictError()
  }

  return true
}

export async function releaseCurrentSessionLock() {
  if (!isSupabaseAuthEnabled) {
    return true
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc(supabaseRpc.releaseSessionLock)

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to release the current login session.',
    )
  }

  return true
}

export async function clearCurrentSupabaseSession() {
  if (!isSupabaseAuthEnabled) {
    return { ok: true }
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut({ scope: 'local' })

  if (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to clear the current Supabase session.',
    )
  }

  return { ok: true }
}

export function isSessionConflictError(error) {
  return (
    error?.code === SESSION_CONFLICT_CODE ||
    collectSessionLockErrorMessages(error).some((message) =>
      isSessionConflictMessage(message)
    )
  )
}
