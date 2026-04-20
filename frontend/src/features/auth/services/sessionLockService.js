import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseAuthEnabled,
  supabaseRpc,
} from '../../../shared/api/supabaseClient'

export const SESSION_CONFLICT_CODE = 'SESSION_LOCK_CONFLICT'
const SESSION_CONFLICT_MESSAGE =
  'This account is already signed in on another device. Sign out there first before trying again.'

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

async function invokeSessionLockRpc(rpcName) {
  if (!isSupabaseAuthEnabled) {
    return true
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc(rpcName)

  if (error) {
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
