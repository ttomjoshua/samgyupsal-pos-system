import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/common/EmptyState'
import Loader from '../components/common/Loader'
import NoticeBanner from '../components/common/NoticeBanner'
import StatusBadge from '../components/common/StatusBadge'
import Modal from '../components/ui/Modal'
import { createBranch, getBranches } from '../services/branchService'
import {
  createManagedEmployeeAccount,
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
  email: '',
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
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false)
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false)
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

  const handleOpenEmployeeModal = () => {
    resetEmployeeForm()
    setIsEmployeeModalOpen(true)
  }

  const handleCloseEmployeeModal = () => {
    setIsEmployeeModalOpen(false)
    resetEmployeeForm()
  }

  const handleOpenBranchModal = () => {
    resetBranchForm()
    setIsBranchModalOpen(true)
  }

  const handleCloseBranchModal = () => {
    setIsBranchModalOpen(false)
    resetBranchForm()
  }

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee)
    setIsEmployeeModalOpen(true)
    setFormError('')
    setPageMessage(`Editing ${employee.name}. Save changes when ready.`)
    setPageMessageTone('info')
    setFormData({
      name: employee.name,
      email: '',
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
        if (editingEmployee) {
          const updatedEmployee = await updateProfileDirectoryEntry(
            editingEmployee.id,
            formData,
          )
          setPageMessage(
            `${updatedEmployee.name} is now assigned to ${updatedEmployee.branchName}.`,
          )
          setPageMessageTone('success')
        } else {
          const createdEmployee = await createManagedEmployeeAccount(formData)
          setPageMessage(
            `${createdEmployee.name} was created in Supabase Auth and assigned to ${createdEmployee.branchName}.`,
          )
          setPageMessageTone('success')
        }
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
      handleCloseEmployeeModal()
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
      handleCloseBranchModal()
      setPageMessage(
        `${createdBranch.name} (${createdBranch.code}) is now available for employee assignment.`,
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

  if (isLoading) {
    return <Loader message="Loading branch and employee accounts..." />
  }

  return (
    <section className="page-shell users-page">
      <div className="page-header">
        <p className="eyebrow">Access Control</p>
        <h2>Users and Branch Access</h2>
        <p className="supporting-text">
          Manage employee login access, branch assignment, and account status from one screen.
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
              ? 'Employee accounts currently synced from Supabase.'
              : 'Employee accounts currently available in the local demo.'}
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
          <p className="card-label">Employee Accounts</p>
          <h2>Access and Assignment</h2>
          <p className="supporting-text">
            {isSupabaseAuthEnabled
              ? 'Open a dedicated employee workspace to create login accounts, assign branches, and update employee status.'
              : 'Open a dedicated employee workspace to create demo accounts, assign branches, and update employee status.'}
          </p>

          <div className="users-overview-grid">
            <article className="users-overview-card">
              <span className="card-label">Employee Directory</span>
              <strong>{employeeAccounts.length}</strong>
              <p className="supporting-text">Accounts currently listed in the employee directory.</p>
            </article>

            <article className="users-overview-card">
              <span className="card-label">Active Today</span>
              <strong>{activeEmployees.length}</strong>
              <p className="supporting-text">Employee accounts ready for sign-in and POS access.</p>
            </article>
          </div>

          <div className="users-panel-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleOpenEmployeeModal}
            >
              Open Employee Manager
            </button>
          </div>
        </div>

        <div className="panel">
          <p className="card-label">Branch Directory</p>
          <h2>Branches and Oversight</h2>
          <p className="supporting-text">
            Open a dedicated branch workspace to add branches and review assignment coverage, contacts, and admin oversight.
          </p>

          <div className="users-overview-grid">
            <article className="users-overview-card">
              <span className="card-label">Branch Records</span>
              <strong>{branchOptions.length}</strong>
              <p className="supporting-text">Available branch definitions ready for staff assignment.</p>
            </article>

            <article className="users-overview-card">
              <span className="card-label">Admin Accounts</span>
              <strong>{adminAccounts.length}</strong>
              <p className="supporting-text">Accounts with full access to branch and employee controls.</p>
            </article>
          </div>

          <div className="users-panel-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleOpenBranchModal}
            >
              Open Branch Directory
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="card-label">Employee Directory</p>
        <h2>Active and Inactive Employee Accounts</h2>
        <p className="supporting-text">
          {isSupabaseAuthEnabled
            ? 'Review employee status and branch assignment here.'
            : 'Review employee status and branch assignment in the local demo directory.'}
        </p>

        {employeeAccounts.length === 0 ? (
          <EmptyState
            title="No employee accounts yet"
            description={
              isSupabaseAuthEnabled
                ? 'Create the first employee account from the form above and it will appear here after the profile sync completes.'
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
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeAccounts.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td>{employee.username || 'Username pending'}</td>
                    <td>{employee.branchName}</td>
                    <td>
                      <StatusBadge
                        text={employee.status === 'active' ? 'Active' : 'Inactive'}
                        variant={employee.status === 'active' ? 'success' : 'default'}
                      />
                    </td>
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

      <Modal
        isOpen={isEmployeeModalOpen}
        eyebrow="Employee Accounts"
        title={
          editingEmployee
            ? 'Edit Employee Account'
            : isSupabaseAuthEnabled
              ? 'Add Employee Account'
              : 'Create Employee Account'
        }
        description={
          isSupabaseAuthEnabled
            ? 'Create employee login accounts, assign branches, and keep employee status accurate from one dedicated workspace.'
            : 'Create employee demo accounts, assign branches, and keep employee status accurate from one dedicated workspace.'
        }
        onClose={handleCloseEmployeeModal}
        width="860px"
      >
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

          {isSupabaseAuthEnabled && !editingEmployee ? (
            <label className="users-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFieldChange}
                placeholder="cashier@samgyupsal.com"
                disabled={isDirectorySaving}
              />
            </label>
          ) : null}

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
          ) : !editingEmployee ? (
            <label className="users-field users-field-wide">
              <span>Temporary Password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleFieldChange}
                placeholder="At least 8 characters"
                disabled={isDirectorySaving}
              />
              <div className="users-inline-note">
                Use a temporary password the employee can change after first login.
              </div>
            </label>
          ) : (
            <div className="users-field users-field-readonly users-field-wide">
              <span>Auth Credentials</span>
              <div className="users-inline-note">
                Email and password stay managed in Supabase Auth. Use this workspace for
                name, username, branch, and status updates.
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
            <button
              type="button"
              className="users-secondary-action"
              onClick={handleCloseEmployeeModal}
              disabled={isDirectorySaving}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button" disabled={isDirectorySaving}>
              {isDirectorySaving
                ? 'Saving...'
                : editingEmployee
                  ? 'Save Employee'
                  : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isBranchModalOpen}
        eyebrow="Branch Directory"
        title="Branches and Assignment"
        description="Add branches and review branch oversight, contacts, and staffing coverage from one dedicated directory workspace."
        onClose={handleCloseBranchModal}
        width="940px"
      >
        <div className="branch-directory-modal">
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
              <button
                type="button"
                className="users-secondary-action"
                onClick={handleCloseBranchModal}
                disabled={isBranchSaving}
              >
                Cancel
              </button>

              <button type="submit" className="primary-button" disabled={isBranchSaving}>
                {isBranchSaving ? 'Saving Branch...' : 'Add Branch'}
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
      </Modal>
    </section>
  )
}

export default UsersPage
