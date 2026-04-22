import {
  getStoredMockAccounts,
  getStoredMockBranches,
  saveStoredMockAccounts,
  saveStoredMockBranches,
} from '../../../shared/utils/storage'
import {
  ROLE_ADMIN,
  ROLE_EMPLOYEE,
  getRoleLabel,
  normalizeRoleKey,
} from '../../../shared/utils/permissions'

const DEFAULT_BRANCHES = [
  {
    id: 1,
    code: 'MAIN',
    name: 'Sta. Lucia',
    status: 'active',
    managerName: '',
    contactNumber: '',
    address: '',
    openingDate: '',
    notes: 'Owner-provided main branch inventory mapping.',
  },
  {
    id: 2,
    code: 'DOLLAR',
    name: 'Dollar',
    status: 'active',
    managerName: '',
    contactNumber: '',
    address: '',
    openingDate: '',
    notes: 'Owner-provided branch inventory mapping.',
  },
]

const DEFAULT_ACCOUNTS = [
  {
    id: 1,
    email: 'admin@samgyupsal.local',
    username: 'admin',
    password: 'admin123',
    name: 'Admin User',
    roleKey: ROLE_ADMIN,
    status: 'active',
    branchId: null,
  },
  {
    id: 2,
    email: 'cashier.main@samgyupsal.local',
    username: 'cashier.main',
    password: 'cashier123',
    name: 'Sta. Lucia Branch Cashier',
    roleKey: ROLE_EMPLOYEE,
    status: 'active',
    branchId: 1,
  },
  {
    id: 3,
    email: 'cashier.dollar@samgyupsal.local',
    username: 'cashier.north',
    password: 'cashier123',
    name: 'Dollar Branch Cashier',
    roleKey: ROLE_EMPLOYEE,
    status: 'active',
    branchId: 2,
  },
]

const LEGACY_BRANCH_ID_ALIASES = {
  'branch-main': 1,
  'branch-north': 2,
  'branch-sta-lucia': 1,
  'branch-dollar': 2,
  'sta.lucia': 1,
  'stalucia': 1,
  dollar: 2,
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeBranchName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeBranchCode(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function normalizeMockEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizeBranchId(value, branches = DEFAULT_BRANCHES) {
  if (value == null || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const rawValue = String(value).trim()

  if (/^\d+$/.test(rawValue)) {
    return Number(rawValue)
  }

  const aliasedBranchId = LEGACY_BRANCH_ID_ALIASES[rawValue.toLowerCase()]

  if (aliasedBranchId) {
    return aliasedBranchId
  }

  const matchedBranch = branches.find((branch) => (
    normalizeBranchCode(branch.code) === normalizeBranchCode(rawValue) ||
    normalizeBranchName(branch.name).toLowerCase() === rawValue.toLowerCase()
  ))

  return matchedBranch?.id ?? null
}

function buildBranchId(code, branches = DEFAULT_BRANCHES) {
  const matchedBranch = branches.find(
    (branch) => normalizeBranchCode(branch.code) === normalizeBranchCode(code),
  )

  if (matchedBranch) {
    return matchedBranch.id
  }

  return (
    branches.reduce((maxId, branch) => Math.max(maxId, Number(branch.id) || 0), 0) + 1
  )
}

function getDefaultBranchTemplate(branch = {}) {
  const normalizedName = normalizeBranchName(branch.name).toLowerCase()
  const normalizedCode = normalizeBranchCode(branch.code)
  const normalizedId = normalizeBranchId(branch.id, DEFAULT_BRANCHES)

  return (
    DEFAULT_BRANCHES.find(
      (defaultBranch) =>
        Number(defaultBranch.id) === Number(normalizedId) ||
        normalizeBranchCode(defaultBranch.code) === normalizedCode ||
        normalizeBranchName(defaultBranch.name).toLowerCase() === normalizedName,
    ) || null
  )
}

function normalizeBranch(branch) {
  const matchedDefaultBranch = getDefaultBranchTemplate(branch)
  const mergedBranch = {
    ...matchedDefaultBranch,
    ...branch,
  }

  const name = normalizeBranchName(mergedBranch.name) || 'Unnamed Branch'
  const code = normalizeBranchCode(mergedBranch.code) || 'BRANCH'

  return {
    id:
      normalizeBranchId(mergedBranch.id, DEFAULT_BRANCHES) ||
      buildBranchId(code, DEFAULT_BRANCHES),
    code,
    name,
    status: mergedBranch.status === 'inactive' ? 'inactive' : 'active',
    managerName:
      normalizeBranchName(mergedBranch.managerName) || 'Manager not yet assigned',
    contactNumber:
      String(mergedBranch.contactNumber || '').trim() || 'Contact not yet added',
    address:
      normalizeBranchName(mergedBranch.address) || 'Branch address not yet added',
    openingDate: String(mergedBranch.openingDate || '').trim(),
    notes: normalizeBranchName(mergedBranch.notes),
  }
}

function ensureMockBranches() {
  const storedBranches = getStoredMockBranches()

  if (storedBranches.length > 0) {
    const normalizedBranches = storedBranches.map((branch) => normalizeBranch(branch))
    saveStoredMockBranches(normalizedBranches)
    return normalizedBranches
  }

  const seededBranches = cloneValue(DEFAULT_BRANCHES).map((branch) =>
    normalizeBranch(branch),
  )
  saveStoredMockBranches(seededBranches)
  return seededBranches
}

function ensureMockAccounts() {
  const storedAccounts = getStoredMockAccounts()

  if (storedAccounts.length > 0) {
    return storedAccounts.map((account) => ({
      ...account,
      branchId: normalizeBranchId(account.branchId, ensureMockBranches()),
    }))
  }

  const seededAccounts = cloneValue(DEFAULT_ACCOUNTS)
  saveStoredMockAccounts(seededAccounts)
  return seededAccounts
}

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function getBranchName(branchId, branches) {
  if (!branchId) {
    return 'All Branches'
  }

  const normalizedBranchId = normalizeBranchId(branchId, branches)
  const matchedBranch = branches.find(
    (branch) => Number(branch.id) === Number(normalizedBranchId),
  )

  return matchedBranch?.name || 'Unassigned Branch'
}

export function normalizeMockUser(user) {
  if (!user || typeof user !== 'object') {
    return null
  }

  const branches = ensureMockBranches()
  const roleKey = normalizeRoleKey(user.roleKey || user.role)
  const branchId = roleKey === ROLE_ADMIN
    ? null
    : normalizeBranchId(user.branchId, branches)

  return {
    id: user.id,
    email: normalizeMockEmail(user.email),
    username: user.username || '',
    name: String(user.name || '').trim() || 'Unnamed User',
    roleKey,
    role: getRoleLabel(roleKey),
    branchId,
    branchName:
      roleKey === ROLE_ADMIN ? 'All Branches' : getBranchName(branchId, branches),
    status: user.status || 'active',
  }
}

export function getMockBranches() {
  return ensureMockBranches().map((branch) => ({ ...branch }))
}

export function getMockUsers() {
  return ensureMockAccounts().map((account) => normalizeMockUser(account))
}

function getNextAccountId(accounts) {
  return (
    accounts.reduce((maxId, account) => Math.max(maxId, Number(account.id) || 0), 0) +
    1
  )
}

function validateBranchPayload(payload, branches) {
  const name = normalizeBranchName(payload.name)
  const code = normalizeBranchCode(payload.code)
  const managerName = normalizeBranchName(payload.managerName)
  const contactNumber = String(payload.contactNumber || '')
    .trim()
    .replace(/\s+/g, ' ')
  const address = normalizeBranchName(payload.address)
  const openingDate = String(payload.openingDate || '').trim()
  const notes = normalizeBranchName(payload.notes)

  if (!name || !code || !managerName || !contactNumber || !address || !openingDate) {
    throw new Error(
      'Branch name, code, manager, contact number, address, and opening date are required.',
    )
  }

  if (contactNumber.replace(/\D/g, '').length < 7) {
    throw new Error('Enter a valid contact number before opening this branch.')
  }

  const duplicateName = branches.some(
    (branch) => normalizeBranchName(branch.name).toLowerCase() === name.toLowerCase(),
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

function validateEmployeePayload(payload, branches, accounts, currentAccountId = null) {
  const name = String(payload.name || '').trim()
  const username = normalizeUsername(payload.username)
  const password = String(payload.password || '')
  const branchId = normalizeBranchId(payload.branchId, branches)

  if (!name || !username || !branchId) {
    throw new Error('Name, username, and branch assignment are required.')
  }

  const matchedBranch = branches.find(
    (branch) => Number(branch.id) === Number(branchId),
  )

  if (!matchedBranch) {
    throw new Error('Select a valid branch before saving this employee.')
  }

  const usernameExists = accounts.some(
    (account) =>
      Number(account.id) !== Number(currentAccountId) &&
      normalizeUsername(account.username) === username,
  )

  if (usernameExists) {
    throw new Error('That username already exists. Choose a different one.')
  }

  if (currentAccountId == null && password.trim().length < 6) {
    throw new Error('Password must be at least 6 characters for a new employee account.')
  }

  if (currentAccountId != null && password && password.trim().length < 6) {
    throw new Error('If you change the password, it must be at least 6 characters long.')
  }

  return {
    name,
    username,
    password,
    branchId,
    status: payload.status === 'inactive' ? 'inactive' : 'active',
  }
}

function validateAdminPayload(payload, accounts) {
  const name = String(payload.name || payload.fullName || '').trim()
  const email = normalizeMockEmail(payload.email)
  const username = normalizeUsername(payload.username)
  const password = String(payload.password || '').trim()

  if (!name || !email || !username) {
    throw new Error('Full name, email, and username are required.')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address before creating this account.')
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.')
  }

  const usernameExists = accounts.some(
    (account) => normalizeUsername(account.username) === username,
  )

  if (usernameExists) {
    throw new Error('That username already exists. Choose a different one.')
  }

  const emailExists = accounts.some(
    (account) => normalizeMockEmail(account.email) === email,
  )

  if (emailExists) {
    throw new Error('That email address is already in use. Choose a different one.')
  }

  return {
    name,
    email,
    username,
    password,
    status: 'active',
  }
}

export function createEmployeeAccount(payload) {
  const branches = ensureMockBranches()
  const accounts = ensureMockAccounts()
  const validatedPayload = validateEmployeePayload(payload, branches, accounts)

  const nextAccount = {
    id: getNextAccountId(accounts),
    name: validatedPayload.name,
    username: validatedPayload.username,
    password: validatedPayload.password.trim(),
    roleKey: ROLE_EMPLOYEE,
    branchId: validatedPayload.branchId,
    status: validatedPayload.status,
  }

  const nextAccounts = [...accounts, nextAccount]
  saveStoredMockAccounts(nextAccounts)

  return normalizeMockUser(nextAccount)
}

export function createAdminAccount(payload) {
  const accounts = ensureMockAccounts()
  const validatedPayload = validateAdminPayload(payload, accounts)

  const nextAccount = {
    id: getNextAccountId(accounts),
    email: validatedPayload.email,
    username: validatedPayload.username,
    password: validatedPayload.password,
    name: validatedPayload.name,
    roleKey: ROLE_ADMIN,
    branchId: null,
    status: validatedPayload.status,
  }

  const nextAccounts = [...accounts, nextAccount]
  saveStoredMockAccounts(nextAccounts)

  return normalizeMockUser(nextAccount)
}

export function createBranch(payload) {
  const branches = ensureMockBranches()
  const validatedPayload = validateBranchPayload(payload, branches)

  const nextBranch = {
    id: buildBranchId(validatedPayload.code, branches),
    name: validatedPayload.name,
    code: validatedPayload.code,
    managerName: validatedPayload.managerName,
    contactNumber: validatedPayload.contactNumber,
    address: validatedPayload.address,
    openingDate: validatedPayload.openingDate,
    notes: validatedPayload.notes,
    status: validatedPayload.status,
  }

  const nextBranches = [...branches, nextBranch]
  saveStoredMockBranches(nextBranches)

  return normalizeBranch(nextBranch)
}

export function updateEmployeeAccount(accountId, payload) {
  const branches = ensureMockBranches()
  const accounts = ensureMockAccounts()
  const accountToUpdate = accounts.find(
    (account) => Number(account.id) === Number(accountId),
  )

  if (!accountToUpdate || accountToUpdate.roleKey !== ROLE_EMPLOYEE) {
    throw new Error('Only employee accounts can be updated here.')
  }

  const validatedPayload = validateEmployeePayload(
    payload,
    branches,
    accounts,
    accountId,
  )

  const nextAccounts = accounts.map((account) => {
    if (Number(account.id) !== Number(accountId)) {
      return account
    }

    return {
      ...account,
      name: validatedPayload.name,
      username: validatedPayload.username,
      branchId: validatedPayload.branchId,
      status: validatedPayload.status,
      password: validatedPayload.password
        ? validatedPayload.password.trim()
        : account.password,
    }
  })

  saveStoredMockAccounts(nextAccounts)

  const updatedAccount = nextAccounts.find(
    (account) => Number(account.id) === Number(accountId),
  )

  return normalizeMockUser(updatedAccount)
}

export function setEmployeeAccountStatus(accountId, status) {
  const nextStatus = status === 'inactive' ? 'inactive' : 'active'
  const accounts = ensureMockAccounts()

  const nextAccounts = accounts.map((account) => {
    if (
      Number(account.id) !== Number(accountId) ||
      account.roleKey !== ROLE_EMPLOYEE
    ) {
      return account
    }

    return {
      ...account,
      status: nextStatus,
    }
  })

  saveStoredMockAccounts(nextAccounts)

  const updatedAccount = nextAccounts.find(
    (account) => Number(account.id) === Number(accountId),
  )

  return normalizeMockUser(updatedAccount)
}

export function findAccountByUsername(username) {
  return ensureMockAccounts().find(
    (account) => normalizeUsername(account.username) === normalizeUsername(username),
  )
}

export function findAccountByEmail(email) {
  return ensureMockAccounts().find(
    (account) => normalizeMockEmail(account.email) === normalizeMockEmail(email),
  )
}

export function getDemoLoginAccounts() {
  const branches = ensureMockBranches()

  return DEFAULT_ACCOUNTS.map((account) => ({
    username: account.username,
    password: account.password,
    role: getRoleLabel(account.roleKey),
    branchName: getBranchName(account.branchId, branches),
  }))
}
