import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

import { isSupabaseAuthEnabled } from '../../../shared/api/supabaseClient'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import Modal from '../../../shared/components/ui/Modal'
import { getDefaultAppPath } from '../../../shared/utils/permissions'
import { getDemoLoginAccounts } from '../../users/services/userService'
import {
  isSessionConflictError,
  isSessionConflictMessage,
} from '../services/sessionLockService'
import { validateLoginForm } from '../../../shared/utils/validation'
import AuthShowcasePanel from '../components/AuthShowcasePanel'
import PasswordVisibilityIcon from '../components/PasswordVisibilityIcon'
import '../styles/auth.css'
import '../styles/login.css'

const LOGIN_HIGHLIGHTS = [
  {
    title: 'Resume daily operations quickly',
    description:
      'Go straight back to checkout, stock monitoring, and dashboard visibility without a cluttered sign-in flow.',
  },
  {
    title: 'Built around branch work',
    description:
      'The same workspace supports cashier execution, inventory awareness, and manager-level oversight.',
  },
  {
    title: 'Role-based routing stays intact',
    description:
      'Administrators and employees continue into the sections that match the current system architecture.',
  },
]

const LOGIN_SNAPSHOT = [
  { label: 'Dashboard', value: 'Sales, stock, and branch visibility' },
  { label: 'Inventory', value: 'Low-stock and expiry tracking' },
  { label: 'POS', value: 'Checkout, payments, and receipt flow' },
]

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { authError, login } = useAuth()

  const usesSupabaseAuth = isSupabaseAuthEnabled
  const demoAccounts = usesSupabaseAuth ? [] : getDemoLoginAccounts()
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSessionAlertOpen, setIsSessionAlertOpen] = useState(false)
  const [registrationNotice, setRegistrationNotice] = useState('')
  const sessionConflictMessage = (
    isSessionConflictMessage(error) ? error : authError
  )

  useEffect(() => {
    if (usesSupabaseAuth && isSessionConflictMessage(sessionConflictMessage)) {
      setIsSessionAlertOpen(true)
    }
  }, [sessionConflictMessage, usesSupabaseAuth])

  useEffect(() => {
    const routeState = location.state

    if (!routeState || typeof routeState !== 'object') {
      return
    }

    const notice = typeof routeState.notice === 'string' ? routeState.notice : ''
    const registeredEmail =
      typeof routeState.registeredEmail === 'string'
        ? routeState.registeredEmail
        : ''
    const registeredUsername =
      typeof routeState.registeredUsername === 'string'
        ? routeState.registeredUsername
        : ''

    if (!notice && !registeredEmail && !registeredUsername) {
      return
    }

    setRegistrationNotice(notice)
    setFormData((previousData) => ({
      ...previousData,
      email: previousData.email || registeredEmail,
      username: previousData.username || registeredUsername,
    }))
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const handleChange = (event) => {
    const { name, value } = event.target

    if (error) {
      setError('')
    }

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const validation = validateLoginForm(formData, { useEmail: usesSupabaseAuth })

    if (!validation.isValid) {
      setError(Object.values(validation.errors)[0] || 'Enter your credentials.')
      return
    }

    setLoading(true)

    try {
      const authenticatedUser = await login(validation.sanitizedData)
      navigate(getDefaultAppPath(authenticatedUser), { replace: true })
    } catch (submissionError) {
      if (isSessionConflictError(submissionError)) {
        setIsSessionAlertOpen(true)
      }

      setError(
        submissionError.response?.data?.message ||
          (usesSupabaseAuth
            ? 'Unable to sign in with this email and password.'
            : 'Incorrect username or password. Please try again.'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <form className="login-card auth-form-card" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <div className="auth-top-links">
              <Link to="/">Back to home</Link>
              <Link to="/signup">Create account</Link>
            </div>

            <p className="eyebrow">Secure Sign In</p>
            <h2>Sign in to your workspace</h2>
            <p className="auth-form-subtitle">
              Access checkout, inventory monitoring, reporting, and branch
              operations from the same product workspace.
            </p>
          </div>

          {registrationNotice ? (
            <NoticeBanner
              variant="success"
              title="Account ready"
              message={registrationNotice}
            />
          ) : null}

          {!usesSupabaseAuth && demoAccounts.length > 0 ? (
            <section className="login-demo">
              <div className="login-demo-header">
                <strong>Demo accounts</strong>
                <span>Use the local accounts below or create a new admin on sign-up.</span>
              </div>

              <div className="login-demo-grid">
                {demoAccounts.map((account) => (
                  <article key={account.username} className="login-demo-card">
                    <strong>{account.username}</strong>
                    <span>{account.password}</span>
                    <p>
                      {account.role} · {account.branchName}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="auth-form-stack">
            <label className="auth-field">
              <span>{usesSupabaseAuth ? 'Email Address' : 'Username'}</span>
              <input
                type={usesSupabaseAuth ? 'email' : 'text'}
                name={usesSupabaseAuth ? 'email' : 'username'}
                placeholder={usesSupabaseAuth ? 'owner@samgyupsal.com' : 'samgyup.admin'}
                value={usesSupabaseAuth ? formData.email : formData.username}
                onChange={handleChange}
                aria-invalid={Boolean(error)}
                disabled={loading}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="login-password-field auth-password-field">
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  aria-invalid={Boolean(error)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-password-visibility"
                  onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  disabled={loading}
                >
                  <PasswordVisibilityIcon isVisible={isPasswordVisible} />
                </button>
              </div>
            </label>
          </div>

          {isSessionConflictMessage(sessionConflictMessage) ? (
            <NoticeBanner
              variant="error"
              title="Account already in use"
              message={sessionConflictMessage}
            />
          ) : error ? (
            <NoticeBanner
              variant="error"
              title="Sign-in issue"
              message={error}
            />
          ) : null}

          <button
            type="submit"
            className="primary-button auth-submit-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>

          <p className="auth-form-footnote">
            Need administrator access? <Link to="/signup">Create an account.</Link>
          </p>
        </form>

        <AuthShowcasePanel
          eyebrow="Operations Access"
          title="The same system your cashier, inventory, and branch teams rely on."
          description="Sign-in should feel focused and trustworthy. The workspace you enter is built around service flow, stock visibility, and day-to-day branch control."
          highlights={LOGIN_HIGHLIGHTS}
          snapshotTitle="After sign-in"
          snapshotItems={LOGIN_SNAPSHOT}
          note="Session conflict protection remains active for accounts already in use on another device."
        />
      </div>

      <Modal
        isOpen={isSessionAlertOpen}
        title="Account already in use"
        description="This sign-in can't continue because the account is active on another device. Ask the current user to sign out, then try again."
        onClose={() => setIsSessionAlertOpen(false)}
        closeLabel="Close sign-in alert"
        width="440px"
      >
        <div className="login-session-alert">
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsSessionAlertOpen(false)}
          >
            Understood
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default LoginPage
