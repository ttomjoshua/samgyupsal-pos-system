import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

import { isSupabaseAuthEnabled } from '../../../shared/api/supabaseClient'
import Modal from '../../../shared/components/ui/Modal'
import { getDefaultAppPath } from '../../../shared/utils/permissions'
import {
  isSessionConflictError,
  SESSION_CONFLICT_MESSAGE,
} from '../services/sessionLockService'
import {
  getFirstValidationError,
  validateLoginForm,
} from '../../../shared/utils/validation'
import '../styles/login.css'

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

  useEffect(() => {
    if (usesSupabaseAuth && authError === SESSION_CONFLICT_MESSAGE) {
      setIsSessionAlertOpen(true)
    }
  }, [authError, usesSupabaseAuth])

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
            className="login-password-toggle"
            onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
          >
            {isPasswordVisible ? 'Hide password' : 'Show password'}
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </div>

        {error ? <p className="login-error">{error}</p> : null}
      </form>

      <Modal
        isOpen={isSessionAlertOpen}
        eyebrow="Sign-in Alert"
        title="Account Already In Use"
        description="This account is already active on another device."
        onClose={() => setIsSessionAlertOpen(false)}
        width="480px"
      >
        <div className="login-session-alert">
          <p>{SESSION_CONFLICT_MESSAGE}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsSessionAlertOpen(false)}
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default LoginPage
