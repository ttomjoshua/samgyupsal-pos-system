import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/common/EmptyState'
import Loader from '../components/common/Loader'
import NoticeBanner from '../components/common/NoticeBanner'
import StatusBadge from '../components/common/StatusBadge'
import { createBranch, getBranches } from '../services/branchService'
import {
  getProfilesDirectory,
  updateProfileDirectoryEntry,
} from '../services/profileService'
import { isSupabaseAuthEnabled } from '../services/supabaseClient'
import {
  createEmployeeAccount,
  getMockUsers,
  setEmployeeAccountStatus,
  updateEmployeeAccount,
} from '../services/userService'
import { shortDate } from '../utils/formatters'
import { ROLE_ADMIN, ROLE_EMPLOYEE } from '../utils/permissions'
import '../styles/users.css'

const INITIAL_EMPLOYEE_FORM = {
  name: '',
  username: '',
  password: '',
  branchId: '',
  status: 'active',
}

const INITIAL_BRANCH_FORM = {
  name: '',
  code: '',
  managerName: '',
  contactNumber: '',
  address: '',
  openingDate: '',
  notes: '',
}

function UsersPage() {
  const [branchOptions, setBranchOptions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [formData, setFormData] = useState(INITIAL_EMPLOYEE_FORM)
  const [formError, setFormError] = useState('')
  const [branchFormData, setBranchFormData] = useState(INITIAL_BRANCH_FORM)
  const [branchFormError, setBranchFormError] = useState('')
  const [isBranchSaving, setIsBranchSaving] = useState(false)
  const [isDirectorySaving, setIsDirectorySaving] = useState(false)
  const [pageMessage, setPageMessage] = useState('')
  const [pageMessageTone, setPageMessageTone] = useState('info')
  const [pageError, setPageError] = useState('')

  useEffect(() => {
    void loadDirectory()
  }, [])

  const loadDirectory = async () => {
    try {
      setIsLoading(true)
      const branches = await getBranches()
      setBranchOptions(branches)

      if (isSupabaseAuthEnabled) {
        setAccounts(await getProfilesDirectory())
      } else {
        setAccounts(getMockUsers())
      }

      setPageError('')
    } catch (error) {
      console.error('Failed to load user directory:', error)
      setBranchOptions([])
      setAccounts([])
      setPageError(
        error.message || 'The employee and branch directory could not be loaded.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const adminAccounts = useMemo(
    () => accounts.filter((account) => account.roleKey === ROLE_ADMIN),
    [accounts],
  )

  const employeeAccounts = useMemo(
    () => accounts.filter((account) => account.roleKey === ROLE_EMPLOYEE),
    [accounts],
  )

  const activeEmployees = useMemo(
    () => employeeAccounts.filter((account) => account.status === 'active'),
    [employeeAccounts],
  )

  const employeeCountByBranch = useMemo(
    () =>
      employeeAccounts.reduce((counts, account) => {
        if (!account.branchId) {
          return counts
        }

        return {
          ...counts,
          [account.branchId]: (counts[account.branchId] || 0) + 1,
        }
      }, {}),
    [employeeAccounts],
  )

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    if (formError) {
      setFormError('')
    }

    setFormData((previousForm) => ({
      ...previousForm,
      [name]: value,
    }))
  }

  const handleBranchFieldChange = (event) => {
    const { name, value } = event.target

    if (branchFormError) {
      setBranchFormError('')
    }

    setBranchFormData((previousForm) => ({
      ...previousForm,
      [name]: value,
    }))
  }

  const resetEmployeeForm = () => {
    setEditingEmployee(null)
    setFormData(INITIAL_EMPLOYEE_FORM)
    setFormError('')
  }

  const resetBranchForm = () => {
    setBranchFormData(INITIAL_BRANCH_FORM)
    setBranchFormError('')
  }

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee)
    setFormError('')
    setPageMessage(`Editing ${employee.name}. Save changes when ready.`)
    setPageMessageTone('info')
    setFormData({
      name: employee.name,
      username: employee.username,
      password: '',
      branchId: employee.branchId || '',
      status: employee.status || 'active',
    })
  }

  const handleSubmitEmployee = async (event) => {
    event.preventDefault()
    setFormError('')
    setIsDirectorySaving(true)

    try {
      if (isSupabaseAuthEnabled) {
        if (!editingEmployee) {
          throw new Error(
            'Create the Auth user in Supabase Dashboard first, then edit the profile here.',
          )
        }

        const updatedEmployee = await updateProfileDirectoryEntry(
          editingEmployee.id,
          formData,
        )
        setPageMessage(
          `${updatedEmployee.name} is now assigned to ${updatedEmployee.branchName}.`,
        )
        setPageMessageTone('success')
      } else if (editingEmployee) {
        const updatedEmployee = updateEmployeeAccount(editingEmployee.id, formData)
        setPageMessage(
          `${updatedEmployee.name} is now assigned to ${updatedEmployee.branchName}.`,
        )
        setPageMessageTone('success')
      } else {
        const createdEmployee = createEmployeeAccount(formData)
        setPageMessage(
          `${createdEmployee.name} was created for ${createdEmployee.branchName}.`,
        )
        setPageMessageTone('success')
      }

      await loadDirectory()
      resetEmployeeForm()
    } catch (error) {
      setFormError(error.message || 'Unable to save this employee account.')
    } finally {
      setIsDirectorySaving(false)
    }
  }

  const handleSubmitBranch = async (event) => {
    event.preventDefault()
    setBranchFormError('')
    setIsBranchSaving(true)

    try {
      const createdBranch = await createBranch(branchFormData)
      await loadDirectory()
      resetBranchForm()
      setPageMessage(
        `${createdBranch.name} (${createdBranch.code}) is now open under ${createdBranch.managerName} and ready for employee assignment.`,
      )
      setPageMessageTone('success')
    } catch (error) {
      setBranchFormError(error.message || 'Unable to create this branch.')
    } finally {
      setIsBranchSaving(false)
    }
  }

  const handleToggleStatus = async (employee) => {
    const nextStatus = employee.status === 'active' ? 'inactive' : 'active'

    try {
      let updatedEmployee = null

      if (isSupabaseAuthEnabled) {
        updatedEmployee = await updateProfileDirectoryEntry(employee.id, {
          ...employee,
          status: nextStatus,
        })
        await loadDirectory()
      } else {
        updatedEmployee = setEmployeeAccountStatus(employee.id, nextStatus)
        setAccounts(getMockUsers())
      }

      setPageMessage(`${updatedEmployee.name} is now ${updatedEmployee.status}.`)
      setPageMessageTone('success')

      if (editingEmployee && String(editingEmployee.id) === String(employee.id)) {
        setEditingEmployee(updatedEmployee)
        setFormData((previousForm) => ({
          ...previousForm,
          status: updatedEmployee.status,
        }))
      }
    } catch (error) {
      setPageMessage(error.message || 'Unable to update this employee status.')
      setPageMessageTone('error')
    }
  }

  const handleRefreshDirectory = async () => {
    try {
      await loadDirectory()
      setPageMessage(
        isSupabaseAuthEnabled
          ? 'Supabase employee directory was refreshed.'
          : 'Frontend employee directory was refreshed.',
      )
      setPageMessageTone('info')
    } catch (error) {
      setPageMessage(error.message || 'Unable to refresh the employee directory.')
      setPageMessageTone('error')
    }
  }

  if (isLoading) {
    return <Loader message="Loading branch and employee accounts..." />
  }

  return (
    <section className="page-shell users-page">
      <div className="page-header">
        <p className="eyebrow">Access Control</p>
        <h2>Branch Assignment and Account Privileges</h2>
        <p className="supporting-text">
          Admin accounts keep full access. Employee accounts are limited to daily POS work
          and must be attached to a branch.
        </p>
      </div>

      {pageError ? (
        <NoticeBanner
          variant="error"
          title="Directory unavailable"
          message={pageError}
        />
      ) : null}

      {!pageError && pageMessage ? (
        <NoticeBanner
          variant={pageMessageTone}
          title="Users screen update"
          message={pageMessage}
        />
      ) : null}

      <div className="card-grid">
        <article className="info-card">
          <p className="card-label">Branches</p>
          <strong>{branchOptions.length}</strong>
          <p className="supporting-text">Available for employee assignment.</p>
        </article>

        <article className="info-card">
          <p className="card-label">Employees</p>
          <strong>{employeeAccounts.length}</strong>
          <p className="supporting-text">
            {isSupabaseAuthEnabled
              ? 'Supabase employee profiles currently visible to admin.'
              : 'Dummy cashier accounts on the frontend.'}
          </p>
        </article>

        <article className="info-card">
          <p className="card-label">Active Today</p>
          <strong>{activeEmployees.length}</strong>
          <p className="supporting-text">Employee accounts ready for POS login.</p>
        </article>
      </div>

      <div className="users-management-grid">
        <div className="panel">
          <p className="card-label">Employee / Cashier Form</p>
          <h2>
            {editingEmployee
              ? 'Update Employee Account'
              : isSupabaseAuthEnabled
                ? 'Supabase Employee Directory'
                : 'Create Employee Account'}
          </h2>
          <p className="supporting-text">
            {isSupabaseAuthEnabled
              ? 'Roles, branch assignments, and account status now come from Supabase profiles.'
              : 'Create dummy employee accounts here and assign each one to a branch.'}
          </p>

          {isSupabaseAuthEnabled && !editingEmployee ? (
            <div className="users-auth-note">
              <strong>Safe admin flow</strong>
              <p>
                New login accounts should still be created in Supabase Dashboard under
                Authentication. Once they exist and the profile trigger runs, refresh this
                directory and click Edit to finish the branch assignment here.
              </p>
              <div className="users-form-actions">
                <button
                  type="button"
                  className="users-secondary-action"
                  onClick={() => {
                    void handleRefreshDirectory()
                  }}
                >
                  Refresh Supabase Directory
                </button>
              </div>
            </div>
          ) : null}

          <form className="users-form" onSubmit={handleSubmitEmployee}>
            <label className="users-field">
              <span>Full Name</span>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFieldChange}
                placeholder="North Branch Cashier"
                disabled={isDirectorySaving}
              />
            </label>

            <label className="users-field">
              <span>Username</span>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleFieldChange}
                placeholder="cashier.north"
                disabled={isDirectorySaving}
              />
            </label>

            {!isSupabaseAuthEnabled ? (
              <label className="users-field">
                <span>{editingEmployee ? 'Password Reset' : 'Temporary Password'}</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFieldChange}
                  placeholder={editingEmployee ? 'Leave blank to keep current password' : 'cashier123'}
                  disabled={isDirectorySaving}
                />
              </label>
            ) : (
              <div className="users-field users-field-readonly">
                <span>Auth Credentials</span>
                <div className="users-inline-note">
                  Email and password remain managed in Supabase Auth and are not edited from
                  this page.
                </div>
              </div>
            )}

            <label className="users-field">
              <span>Assigned Branch</span>
              <select
                name="branchId"
                value={formData.branchId}
                onChange={handleFieldChange}
                disabled={isDirectorySaving}
              >
                <option value="">Select branch</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="users-field users-field-wide">
              <span>Status</span>
              <select
                name="status"
                value={formData.status}
                onChange={handleFieldChange}
                disabled={isDirectorySaving}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            {formError ? (
              <p className="users-form-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="users-form-actions">
              {editingEmployee ? (
                <button
                  type="button"
                  className="users-secondary-action"
                  onClick={resetEmployeeForm}
                  disabled={isDirectorySaving}
                >
                  Cancel Edit
                </button>
              ) : null}

              {isSupabaseAuthEnabled && !editingEmployee ? null : (
                <button type="submit" className="primary-button" disabled={isDirectorySaving}>
                  {isDirectorySaving
                    ? 'Saving...'
                    : editingEmployee
                      ? 'Save Employee'
                      : 'Create Employee'}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <p className="card-label">Branch Directory</p>
          <h2>Current Branch Scope</h2>
          <p className="supporting-text">
            Employee accounts can be pinned to one branch only in this frontend stage.
          </p>

          <div className="branch-process-note">
            <strong>What opening a branch does here</strong>
            <ul>
              <li>Adds the branch to the shared assignment dropdown for employee accounts.</li>
              <li>Writes the branch profile into the Supabase branch table when available.</li>
              <li>Shows the responsible manager, contact, address, and opening date.</li>
            </ul>
          </div>

          <form className="branch-form" onSubmit={handleSubmitBranch}>
            <label className="users-field">
              <span>Branch Name</span>
              <input
                type="text"
                name="name"
                value={branchFormData.name}
                onChange={handleBranchFieldChange}
                placeholder="Cainta Branch"
                aria-invalid={Boolean(branchFormError)}
                disabled={isBranchSaving}
              />
            </label>

            <label className="users-field">
              <span>Branch Code</span>
              <input
                type="text"
                name="code"
                value={branchFormData.code}
                onChange={handleBranchFieldChange}
                placeholder="CAINTA"
                aria-invalid={Boolean(branchFormError)}
                disabled={isBranchSaving}
              />
            </label>

            <label className="users-field">
              <span>Manager In Charge</span>
              <input
                type="text"
                name="managerName"
                value={branchFormData.managerName}
                onChange={handleBranchFieldChange}
                placeholder="Patricia Ramos"
                aria-invalid={Boolean(branchFormError)}
                disabled={isBranchSaving}
              />
            </label>

            <label className="users-field">
              <span>Contact Number</span>
              <input
                type="text"
                name="contactNumber"
                value={branchFormData.contactNumber}
                onChange={handleBranchFieldChange}
                placeholder="0917 800 4400"
                aria-invalid={Boolean(branchFormError)}
                disabled={isBranchSaving}
              />
            </label>

            <label className="users-field users-field-wide">
              <span>Branch Address</span>
              <input
                type="text"
                name="address"
                value={branchFormData.address}
                onChange={handleBranchFieldChange}
                placeholder="Ortigas Avenue Extension, Cainta, Rizal"
                aria-invalid={Boolean(branchFormError)}
                disabled={isBranchSaving}
              />
            </label>

            <label className="users-field">
              <span>Opening Date</span>
              <input
                type="date"
                name="openingDate"
                value={branchFormData.openingDate}
                onChange={handleBranchFieldChange}
                aria-invalid={Boolean(branchFormError)}
                disabled={isBranchSaving}
              />
            </label>

            <label className="users-field users-field-wide">
              <span>Branch Notes</span>
              <textarea
                name="notes"
                value={branchFormData.notes}
                onChange={handleBranchFieldChange}
                placeholder="Optional context for this branch, such as staffing or launch notes."
                aria-invalid={Boolean(branchFormError)}
                disabled={isBranchSaving}
              />
            </label>

            {branchFormError ? (
              <p className="users-form-error" role="alert">
                {branchFormError}
              </p>
            ) : null}

            <div className="users-form-actions">
              <button type="submit" className="primary-button" disabled={isBranchSaving}>
                {isBranchSaving ? 'Opening Branch...' : 'Open Branch'}
              </button>
            </div>
          </form>

          {branchOptions.length === 0 ? (
            <EmptyState
              title="No branches available"
              description="Add branch definitions to the shared branch table before assigning employees."
            />
          ) : (
            <div className="branch-list">
              {branchOptions.map((branch) => (
                <article key={branch.id} className="branch-card">
                  <div className="branch-card-top">
                    <div>
                      <div className="branch-title-row">
                        <strong>{branch.name}</strong>
                        <span className="branch-code-pill">{branch.code}</span>
                      </div>
                      <p className="branch-card-address">{branch.address}</p>
                    </div>
                    <StatusBadge
                      text={branch.status === 'active' ? 'Active Branch' : 'Inactive'}
                      variant={branch.status === 'active' ? 'success' : 'default'}
                    />
                  </div>

                  <div className="branch-card-meta">
                    <div>
                      <span>Manager</span>
                      <strong>{branch.managerName}</strong>
                    </div>
                    <div>
                      <span>Contact</span>
                      <strong>{branch.contactNumber}</strong>
                    </div>
                    <div>
                      <span>Opened</span>
                      <strong>{shortDate(branch.openingDate)}</strong>
                    </div>
                    <div>
                      <span>Assigned Staff</span>
                      <strong>{employeeCountByBranch[branch.id] || 0}</strong>
                    </div>
                  </div>

                  {branch.notes ? (
                    <p className="branch-card-notes">{branch.notes}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}

          <div className="admin-accounts">
            <p className="card-label">Admin Accounts</p>
            {adminAccounts.map((account) => (
              <article key={account.id} className="admin-card">
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.username || 'Username pending'}</p>
                </div>
                <StatusBadge text="Full Privileges" variant="success" />
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="card-label">Employee Directory</p>
        <h2>Active and Inactive Employee Accounts</h2>
        <p className="supporting-text">
          {isSupabaseAuthEnabled
            ? 'These employee records now come from Supabase profiles. Real Auth user creation should still happen in Supabase Dashboard or a protected backend path.'
            : 'These are dummy frontend accounts only. Backend access control will still need to enforce the same rules later.'}
        </p>

        {employeeAccounts.length === 0 ? (
          <EmptyState
            title="No employee accounts yet"
            description={
              isSupabaseAuthEnabled
                ? 'Create the next employee in Supabase Authentication first, then refresh this screen to assign the branch and username.'
                : 'Create the first branch-assigned employee account to start testing role-based screens.'
            }
          />
        ) : (
          <div className="users-table-shell">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Privileges</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeAccounts.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td>{employee.username || 'Username pending'}</td>
                    <td>{employee.role}</td>
                    <td>{employee.branchName}</td>
                    <td>
                      <StatusBadge
                        text={employee.status === 'active' ? 'Active' : 'Inactive'}
                        variant={employee.status === 'active' ? 'success' : 'default'}
                      />
                    </td>
                    <td>POS only</td>
                    <td>
                      <div className="users-table-actions">
                        <button
                          type="button"
                          className="users-table-button"
                          onClick={() => handleEditEmployee(employee)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="users-table-button"
                          onClick={() => {
                            void handleToggleStatus(employee)
                          }}
                        >
                          {employee.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default UsersPage
