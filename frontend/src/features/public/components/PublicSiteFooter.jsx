import { Link } from 'react-router-dom'
import PublicBrand from '../../../shared/components/common/PublicBrand'

function PublicSiteFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer-brand">
        <PublicBrand compact />
        <p>
          Built for cashier stations, inventory review, branch managers, and
          day-to-day oversight across Samgyupsal operations.
        </p>
      </div>

      <div className="public-site-footer-column">
        <span>Product</span>
        <a href="#product">Operational value</a>
        <a href="#features">Feature highlights</a>
        <a href="#preview">Interface preview</a>
      </div>

      <div className="public-site-footer-column">
        <span>Access</span>
        <Link to="/login">Log In</Link>
        <Link to="/signup">Create account</Link>
      </div>
    </footer>
  )
}

export default PublicSiteFooter
