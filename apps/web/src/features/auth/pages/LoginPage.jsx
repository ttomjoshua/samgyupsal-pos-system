import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

import { isSupabaseAuthEnabled } from '../../../shared/supabase/client'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import Modal from '../../../shared/components/ui/Modal'
import { getDefaultAppPath } from '../../../shared/utils/permissions'
import {
  isSessionConflictError,
  isSessionConflictMessage,
} from '../services/sessionLockService'
import {
  getFirstValidationError,
  validateLoginForm,
} from '../../../shared/utils/validation'
import '../styles/login.css'

function PasswordVisibilityIcon({ isVisible }) {
  if (isVisible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 4l16 16M9.9 9.9A3 3 0 0012 15a2.99 2.99 0 002.1-.9M6.7 6.7C4.5 8.2 3 10.3 2 12c2.2 3.9 5.8 6 10 6 1.9 0 3.6-.4 5.1-1.2m1.9-1.5c1.3-1 2.3-2.2 3-3.3-2.2-3.9-5.8-6-10-6-.8 0-1.5.1-2.2.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12c2.2-3.9 5.8-6 10-6s7.8 2.1 10 6c-2.2 3.9-5.8 6-10 6S4.2 15.9 2 12z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const { authError, login } = useAuth()

  const usesSupabaseAuth = isSupabaseAuthEnabled
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSessionAlertOpen, setIsSessionAlertOpen] = useState(false)
  const sessionConflictMessage = (
    isSessionConflictMessage(error) ? error : authError
  )

  useEffect(() => {
    if (usesSupabaseAuth && isSessionConflictMessage(sessionConflictMessage)) {
      setIsSessionAlertOpen(true)
    }
  }, [sessionConflictMessage, usesSupabaseAuth])

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
      setError(getFirstValidationError(validation.errors))
      return
    }

    setLoading(true)

    try {
      const authenticatedUser = await login(validation.sanitizedData)
      navigate(getDefaultAppPath(authenticatedUser), { replace: true })
    } catch (error) {
      if (isSessionConflictError(error)) {
        setIsSessionAlertOpen(true)
      }

      setError(
        error.response?.data?.message ||
          (usesSupabaseAuth
            ? 'Unable to sign in with this email and password.'
            : 'Incorrect username or password. Please try again.'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Welcome back</p>
        <h1>SamgYUPSAL Korean Food</h1>
        <p className="login-subtitle">
          Point-of-Sale and Inventory Monitoring System
        </p>

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
      </form>

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
