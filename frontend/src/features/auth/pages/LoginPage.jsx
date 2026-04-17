import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

import { isSupabaseAuthEnabled } from '../../../shared/api/supabaseClient'
import { getDefaultAppPath } from '../../../shared/utils/permissions'
import {
  getFirstValidationError,
  validateLoginForm,
} from '../../../shared/utils/validation'
import '../styles/login.css'

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const usesSupabaseAuth = isSupabaseAuthEnabled
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
          />

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
    </div>
  )
}

export default LoginPage
