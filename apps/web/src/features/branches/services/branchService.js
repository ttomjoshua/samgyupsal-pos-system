import {
  getStoredMockBranches,
  saveStoredMockBranches,
} from '../../../shared/utils/storage'
import {
  clearCachedResource,
  getCachedResource,
  setCachedResource,
} from '../../../shared/utils/resourceCache'
import { createBranch as createLocalBranch, getMockBranches } from '../../users/services/userService'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseDataEnabled,
  supabaseTables,
} from '../../../shared/api/supabaseClient'

function normalizeBranchText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeBranchCode(value) {
  return normalizeBranchText(value).toUpperCase()
}

function normalizeBranchStatus(value) {
  return String(value || '').trim().toLowerCase() === 'inactive'
    ? 'inactive'
    : 'active'
}

function normalizeBranchRecord(branch) {
  return {
    id: Number(branch.id),
    code: normalizeBranchCode(branch.code) || 'BRANCH',
    name: normalizeBranchText(branch.name) || 'Unnamed Branch',
    status: normalizeBranchStatus(branch.status),
    managerName:
      normalizeBranchText(branch.manager_name ?? branch.managerName) ||
      'Manager not yet assigned',
    contactNumber:
      normalizeBranchText(branch.contact_number ?? branch.contactNumber) ||
      'Contact not yet added',
    address:
      normalizeBranchText(branch.address) || 'Branch address not yet added',
    openingDate: String(branch.opening_date ?? branch.openingDate ?? '').trim(),
    notes: normalizeBranchText(branch.notes),
    createdAt: String(branch.created_at ?? branch.createdAt ?? '').trim(),
    updatedAt: String(branch.updated_at ?? branch.updatedAt ?? '').trim(),
  }
}

function sortBranchesByName(branches) {
  return [...branches].sort((left, right) =>
    left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }),
  )
}

const BRANCHES_CACHE_KEY = 'branches:all'
const BRANCHES_CACHE_TTL_MS = 5 * 60 * 1000

function syncBranchCache(branches) {
  const normalizedBranches = sortBranchesByName(
    branches.map((branch) => normalizeBranchRecord(branch)),
  )
  setCachedResource(BRANCHES_CACHE_KEY, normalizedBranches)
  saveStoredMockBranches(normalizedBranches)
  return normalizedBranches
}

export function getCachedBranches() {
  return getCachedResource(BRANCHES_CACHE_KEY, BRANCHES_CACHE_TTL_MS)
}

function getLocalBranchFallback() {
  const cachedBranches = getStoredMockBranches()

  if (cachedBranches.length > 0) {
    return syncBranchCache(cachedBranches)
  }

  return syncBranchCache(getMockBranches())
}

function validateBranchPayload(payload, branches) {
  const name = normalizeBranchText(payload.name)
  const code = normalizeBranchCode(payload.code)
  const managerName = normalizeBranchText(payload.managerName)
  const contactNumber = normalizeBranchText(payload.contactNumber)
  const address = normalizeBranchText(payload.address)
  const openingDate = String(payload.openingDate || '').trim()
  const notes = normalizeBranchText(payload.notes)

  if (!name || !code || !managerName || !contactNumber || !address || !openingDate) {
    throw new Error(
      'Branch name, code, manager, contact number, address, and opening date are required.',
    )
  }

  if (contactNumber.replace(/\D/g, '').length < 7) {
    throw new Error('Enter a valid contact number before opening this branch.')
  }

  const duplicateName = branches.some(
    (branch) => normalizeBranchText(branch.name).toLowerCase() === name.toLowerCase(),
  )

  if (duplicateName) {
    throw new Error('That branch name already exists. Use a different branch name.')
  }

  const duplicateCode = branches.some(
    (branch) => normalizeBranchCode(branch.code) === code,
  )

  if (duplicateCode) {
    throw new Error('That branch code already exists. Use a different branch code.')
  }

  return {
    name,
    code,
    managerName,
    contactNumber,
    address,
    openingDate,
    notes,
    status: 'active',
  }
}

function buildSupabaseBranchPayload(branch) {
  return {
    code: branch.code,
    name: branch.name,
    status: branch.status,
    manager_name: branch.managerName,
    contact_number: branch.contactNumber,
    address: branch.address,
    opening_date: branch.openingDate,
    notes: branch.notes,
  }
}

export async function getBranches() {
  const cachedBranches = getCachedBranches()

  if (cachedBranches) {
    return cachedBranches
  }

  if (!isSupabaseDataEnabled) {
    return getLocalBranchFallback()
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseTables.branches)
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    return syncBranchCache(data || [])
  } catch (error) {
    console.error('Failed to load branches from Supabase:', error)
    const fallbackBranches = getLocalBranchFallback()

    if (fallbackBranches.length > 0) {
      return fallbackBranches
    }

    throw createSupabaseServiceError(
      error,
      'Unable to load branches from Supabase.',
    )
  }
}

export async function createBranch(payload) {
  if (!isSupabaseDataEnabled) {
    const createdBranch = createLocalBranch(payload)
    syncBranchCache(getMockBranches())
    return normalizeBranchRecord(createdBranch)
  }

  clearCachedResource(BRANCHES_CACHE_KEY)
  const existingBranches = await getBranches()
  const validatedBranch = validateBranchPayload(payload, existingBranches)

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(supabaseTables.branches)
      .insert(buildSupabaseBranchPayload(validatedBranch))
      .select('*')
      .single()

    if (error) {
      throw error
    }

    const createdBranch = normalizeBranchRecord(data)
    syncBranchCache([...existingBranches, createdBranch])
    return createdBranch
  } catch (error) {
    throw createSupabaseServiceError(
      error,
      'Unable to create this branch in Supabase.',
    )
  }
}
