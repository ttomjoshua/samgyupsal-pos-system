import { Link } from 'react-router-dom'
import PublicBrand from '../../../shared/components/common/PublicBrand'

function PublicSiteHeader() {
  return (
    <header className="public-site-header">
      <PublicBrand compact showDescription={false} />

      <nav className="public-site-nav" aria-label="Landing page">
        <a href="#product">Product</a>
        <a href="#features">Features</a>
        <a href="#workflow">Workflow</a>
        <a href="#preview">Preview</a>
      </nav>

      <div className="public-site-actions">
        <Link to="/login" className="public-link-button">
          Log In
        </Link>
        <Link to="/signup" className="public-primary-button">
          Sign Up
        </Link>
      </div>
    </header>
  )
}

export default PublicSiteHeader
