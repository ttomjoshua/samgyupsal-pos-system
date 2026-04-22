import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import {
  getFirstValidationError,
  validateRegistrationForm,
} from '../../../shared/utils/validation'
import PasswordVisibilityIcon from '../components/PasswordVisibilityIcon'
import AuthShowcasePanel from '../components/AuthShowcasePanel'
import {
  getRegistrationSupportMessage,
  registerWorkspaceOwner,
} from '../services/registrationService'
import { isSupabaseAuthEnabled } from '../../../shared/api/supabaseClient'
import '../styles/auth.css'
import '../styles/login.css'

const SIGN_UP_HIGHLIGHTS = [
  {
    title: 'Administrator-first access',
    description:
      'Start with the account that can manage products, branches, reports, and employee access.',
  },
  {
    title: 'Branch setup follows naturally',
    description:
      'Once inside the system, you can add branches and assign employee accounts from the built-in user tools.',
  },
  {
    title: 'Aligned with the live product',
    description:
      'This registration flow is shaped around the existing POS, inventory, reporting, and access-control architecture.',
  },
]

const INITIAL_FORM = {
  fullName: '',
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
}

function SignUpPage() {
  const navigate = useNavigate()
  const usesSupabaseAuth = isSupabaseAuthEnabled
  const supportMessage = getRegistrationSupportMessage()
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }))

    if (error) {
      setError('')
    }

    if (fieldErrors[name]) {
      setFieldErrors((previousErrors) => ({
        ...previousErrors,
        [name]: '',
      }))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const validation = validateRegistrationForm(formData)

    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      setError(getFirstValidationError(validation.errors))
      return
    }

    setFieldErrors({})
    setLoading(true)

    try {
      await registerWorkspaceOwner(validation.sanitizedData)
      navigate('/login', {
        replace: true,
        state: {
          notice:
            'Administrator account created. Sign in with your username and password to open the workspace.',
          registeredUsername: validation.sanitizedData.username,
          registeredEmail: validation.sanitizedData.email,
        },
      })
    } catch (submissionError) {
      setError(
        submissionError.response?.data?.message ||
          submissionError.message ||
          'Unable to create your account right now.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthShowcasePanel
          eyebrow="Get Started"
          title="Open your Samgyupsal POS workspace with a proper administrator account."
          description="This sign-up flow is built to feel native to the product. Create your admin access first, then continue with branch setup, employee management, inventory, and checkout inside the main app."
          highlights={SIGN_UP_HIGHLIGHTS}
          note="Branch assignments and employee accounts are configured after sign-in because the current system manages them inside the protected workspace."
        />

        <form className="login-card auth-form-card" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <div className="auth-top-links">
              <Link to="/">Back to home</Link>
              <Link to="/login">Log in instead</Link>
            </div>

            <p className="eyebrow">Registration</p>
            <h2>Create your administrator account</h2>
            <p className="auth-form-subtitle">
              Start with the account that can oversee dashboard activity,
              products, branches, employee access, and reporting.
            </p>
          </div>

          <NoticeBanner
            variant="info"
            title={usesSupabaseAuth ? 'Backend support still required' : 'Demo sign-up is available'}
            message={supportMessage}
          />

          <div className="auth-form-grid">
            <label className="auth-field">
              <span>Full Name</span>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Patricia Ramos"
                aria-invalid={Boolean(fieldErrors.fullName)}
                disabled={loading}
              />
              {fieldErrors.fullName ? (
                <span className="auth-field-error">{fieldErrors.fullName}</span>
              ) : null}
            </label>

            <label className="auth-field">
              <span>Email Address</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="owner@samgyupsal.com"
                aria-invalid={Boolean(fieldErrors.email)}
                disabled={loading}
              />
              {fieldErrors.email ? (
                <span className="auth-field-error">{fieldErrors.email}</span>
              ) : null}
            </label>

            <label className="auth-field auth-field-wide">
              <span>Username</span>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="samgyup.admin"
                aria-invalid={Boolean(fieldErrors.username)}
                disabled={loading}
              />
              {fieldErrors.username ? (
                <span className="auth-field-error">{fieldErrors.username}</span>
              ) : null}
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="login-password-field auth-password-field">
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  aria-invalid={Boolean(fieldErrors.password)}
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
              {fieldErrors.password ? (
                <span className="auth-field-error">{fieldErrors.password}</span>
              ) : null}
            </label>

            <label className="auth-field">
              <span>Confirm Password</span>
              <div className="login-password-field auth-password-field">
                <input
                  type={isConfirmPasswordVisible ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-password-visibility"
                  onClick={() =>
                    setIsConfirmPasswordVisible((currentValue) => !currentValue)
                  }
                  aria-label={
                    isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'
                  }
                  disabled={loading}
                >
                  <PasswordVisibilityIcon isVisible={isConfirmPasswordVisible} />
                </button>
              </div>
              {fieldErrors.confirmPassword ? (
                <span className="auth-field-error">
                  {fieldErrors.confirmPassword}
                </span>
              ) : null}
            </label>
          </div>

          {error ? (
            <NoticeBanner
              variant="error"
              title="Registration issue"
              message={error}
            />
          ) : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Creating account...' : 'Create administrator account'}
          </button>

          <p className="auth-form-footnote">
            Already have access? <Link to="/login">Log in here.</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default SignUpPage
