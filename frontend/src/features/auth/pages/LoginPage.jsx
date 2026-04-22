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
    title: 'Dashboard visibility',
    description:
      'Continue into live branch activity, best-seller trends, low-stock watchlists, and operational summaries.',
  },
  {
    title: 'Connected daily workflow',
    description:
      'Move between checkout, inventory, products, reports, and account tools without breaking the product flow.',
  },
  {
    title: 'Role-based access',
    description:
      'Administrator and employee accounts stay aligned with the permissions and branch rules already defined in the app.',
  },
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
        <AuthShowcasePanel
          eyebrow="Welcome Back"
          title="Return to the Samgyupsal POS workspace without losing operational context."
          description="Sign in to continue with dashboard monitoring, branch inventory, checkout operations, product management, and account oversight from the same connected system."
          highlights={LOGIN_HIGHLIGHTS}
          note="The login flow keeps the current session conflict protection and role-aware routing intact."
        />

        <form className="login-card auth-form-card" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <div className="auth-top-links">
              <Link to="/">Back to home</Link>
              <Link to="/signup">Create account</Link>
            </div>

            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to SamgYUPSAL Korean Food</h2>
            <p className="login-subtitle">
              Point-of-Sale and Inventory Monitoring System
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
            <div className="login-demo">
              <p className="login-demo-title">Demo access is available</p>
              {demoAccounts.map((account) => (
                <p key={account.username}>
                  <strong>{account.username}</strong> / {account.password}
                  <span className="login-demo-branch">
                    {' '}
                    {account.role} - {account.branchName}
                  </span>
                </p>
              ))}
              <p className="login-demo-footnote">
                Administrator sign-up also works in demo mode and creates a local
                account for this browser.
              </p>
            </div>
          ) : null}

          <div className="login-form">
            {usesSupabaseAuth ? (
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(error)}
              />
            ) : (
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                aria-invalid={Boolean(error)}
              />
            )}

            <label className="login-password-field">
              <input
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                aria-invalid={Boolean(error)}
              />
              <button
                type="button"
                className="login-password-visibility"
                onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                <PasswordVisibilityIcon isVisible={isPasswordVisible} />
              </button>
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
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

          <p className="auth-form-footnote">
            Need a new administrator account?{' '}
            <Link to="/signup">Start with sign-up.</Link>
          </p>
        </form>
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
