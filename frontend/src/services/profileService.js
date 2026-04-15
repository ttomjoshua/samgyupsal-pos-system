import { getRoleLabel, normalizeRoleKey } from '../utils/permissions'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseAuthEnabled,
  supabaseTables,
} from './supabaseClient'

function buildProfileSelectQuery() {
  return [
    'id',
    'username',
    'full_name',
    'role_key',
    'branch_id',
    'status',
    'created_at',
    'updated_at',
    `branch:${supabaseTables.branches}(id,name,code,status)`,
  ].join(',')
}

function normalizeProfileText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function buildFallbackName(authUser, profile) {
  const candidateName =
    profile?.full_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    authUser?.email

  return normalizeProfileText(candidateName) || 'Unnamed User'
}

function buildFallbackUsername(authUser, profile) {
  const candidateUsername =
    profile?.username ||
    authUser?.user_metadata?.username ||
    authUser?.email?.split('@')?.[0]

  return normalizeProfileText(candidateUsername).toLowerCase()
}

export function normalizeSupabaseProfileUser(profile, authUser) {
  const roleKey = normalizeRoleKey(profile?.role_key)
  const branchId = roleKey === 'admin' ? null : profile?.branch_id ?? null

  return {
    id: authUser.id,
    email: String(authUser.email || '').trim().toLowerCase(),
    username: buildFallbackUsername(authUser, profile),
    name: buildFallbackName(authUser, profile),
    roleKey,
    role: getRoleLabel(roleKey),
    branchId,
    branchName:
      roleKey === 'admin'
        ? 'All Branches'
        : profile?.branch?.name || 'Unassigned Branch',
    status: normalizeProfileText(profile?.status).toLowerCase() || 'active',
  }
}

function normalizeDirectoryProfile(profile) {
  const roleKey = normalizeRoleKey(profile?.role_key)
  const branchId = roleKey === 'admin' ? null : profile?.branch_id ?? null

  return {
    id: profile.id,
    username: normalizeProfileText(profile?.username).toLowerCase(),
    name: normalizeProfileText(profile?.full_name) || 'Unnamed User',
    roleKey,
    role: getRoleLabel(roleKey),
    branchId,
    branchName:
      roleKey === 'admin'
        ? 'All Branches'
        : profile?.branch?.name || 'Unassigned Branch',
    status: normalizeProfileText(profile?.status).toLowerCase() || 'active',
    createdAt: String(profile?.created_at || '').trim(),
    updatedAt: String(profile?.updated_at || '').trim(),
  }
}

function normalizeDirectoryUsername(value) {
  return normalizeProfileText(value).toLowerCase()
}

function normalizeDirectoryStatus(value) {
  return String(value || '').trim().toLowerCase() === 'inactive'
    ? 'inactive'
    : 'active'
}

function parseDirectoryBranchId(value) {
  if (value == null || value === '') {
    return null
  }

  const branchId = Number(value)
  return Number.isFinite(branchId) && branchId > 0 ? branchId : null
}

function validateDirectoryProfilePayload(profileId, payload = {}) {
  if (!profileId) {
    throw new Error('A profile id is required before saving this employee.')
  }

  const roleKey = normalizeRoleKey(payload.roleKey || payload.role)
  const fullName = normalizeProfileText(payload.name || payload.full_name)
  const username = normalizeDirectoryUsername(payload.username)
  const status = normalizeDirectoryStatus(payload.status)
  const branchId = roleKey === 'admin' ? null : parseDirectoryBranchId(payload.branchId)

  if (!fullName) {
    throw new Error('Full name is required before saving this employee.')
  }

  if (!username) {
    throw new Error('Username is required before saving this employee.')
  }

  if (roleKey === 'employee' && !branchId) {
    throw new Error('Employee accounts must be assigned to a branch.')
  }

  return {
    full_name: fullName,
    username,
    role_key: roleKey,
    branch_id: branchId,
    status,
  }
}

export async function getProfileForAuthUser(authUser) {
  if (!authUser?.id) {
    return null
  }

  if (!isSupabaseAuthEnabled) {
    return null
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseTables.profiles)
      .select(buildProfileSelectQuery())
      .eq('id', authUser.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error(
        'This account exists in Supabase Auth but has no profile record yet. Ask an admin to finish the profile setup.',
      )
    }

    return normalizeSupabaseProfileUser(data, authUser)
  } catch (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to load the authenticated user profile from Supabase.',
    )
  }
}

export async function getProfilesDirectory() {
  if (!isSupabaseAuthEnabled) {
    return []
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseTables.profiles)
      .select(buildProfileSelectQuery())
      .order('full_name', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map((profile) => normalizeDirectoryProfile(profile))
  } catch (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to load the employee directory from Supabase.',
    )
  }
}

export async function updateProfileDirectoryEntry(profileId, payload = {}) {
  if (!isSupabaseAuthEnabled) {
    throw new Error('Supabase auth must be enabled before updating profiles.')
  }

  const updatePayload = validateDirectoryProfilePayload(profileId, payload)

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseTables.profiles)
      .update(updatePayload)
      .eq('id', profileId)
      .select(buildProfileSelectQuery())
      .single()

    if (error) {
      throw error
    }

    return normalizeDirectoryProfile(data)
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()

    if (message.includes('duplicate key') || message.includes('profiles_username_key')) {
      throw new Error('That username already exists in Supabase. Choose a different one.')
    }

    throw createSupabaseServiceError(
      error,
      'Unable to update this employee profile in Supabase.',
    )
  }
}
