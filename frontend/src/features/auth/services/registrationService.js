import { isSupabaseAuthEnabled } from '../../../shared/api/supabaseClient'
import { createAdminAccount } from '../../users/services/userService'

function createRegistrationError(message, cause = null) {
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

export function getRegistrationSupportMessage() {
  if (!isSupabaseAuthEnabled) {
    return 'Demo mode can create a local administrator account right away so you can explore the full system flow.'
  }

  return 'Public registration UI is ready, but the Supabase project still needs a secure self-registration or approval endpoint that creates the matching admin profile.'
}

export async function registerWorkspaceOwner(payload = {}) {
  if (isSupabaseAuthEnabled) {
    throw createRegistrationError(
      'Public self-registration is not enabled for this environment yet. Connect a secure onboarding function or admin approval flow before activating sign-up.',
    )
  }

  try {
    return {
      user: createAdminAccount(payload),
    }
  } catch (error) {
    throw createRegistrationError(
      error?.message || 'Unable to create this administrator account.',
      error,
    )
  }
}
