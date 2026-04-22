import { Link } from 'react-router-dom'
import PublicBrand from '../../../shared/components/common/PublicBrand'

function PublicSiteHeader() {
  return (
    <header className="public-site-header">
      <PublicBrand />

      <nav className="public-site-nav" aria-label="Landing page">
        <a href="#features">Features</a>
        <a href="#workflow">How It Works</a>
        <a href="#preview">Preview</a>
      </nav>

      <div className="public-site-actions">
        <Link to="/login" className="public-site-link">
          Log In
        </Link>
        <Link to="/signup" className="primary-button public-site-button">
          Sign Up
        </Link>
      </div>
    </header>
  )
}

export default PublicSiteHeader
