import { Link } from 'react-router-dom'
import PublicBrand from '../../shared/components/common/PublicBrand'
import '../../features/auth/styles/auth.css'
import '../../features/public/styles/public.css'

function NotFoundPage() {
  return (
    <main className="auth-page">
      <section className="login-card auth-form-card">
        <PublicBrand />
        <p className="eyebrow">Page Not Found</p>
        <h2>The page you opened is not available in this workspace.</h2>
        <p className="auth-form-subtitle">
          Return to the landing page, continue to the login flow, or head back
          to the main app entry point.
        </p>

        <div className="landing-cta-actions">
          <Link to="/" className="primary-button">
            Go Home
          </Link>
          <Link to="/login" className="landing-secondary-button">
            Log In
          </Link>
        </div>
      </section>
    </main>
  )
}

export default NotFoundPage
