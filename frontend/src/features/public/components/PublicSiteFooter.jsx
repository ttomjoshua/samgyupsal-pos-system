import { Link } from 'react-router-dom'
import PublicBrand from '../../../shared/components/common/PublicBrand'

function PublicSiteFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer-top">
        <PublicBrand compact />
        <p>
          Built for branch managers, cashiers, and operators who need checkout,
          inventory, products, and reporting in one dependable workspace.
        </p>
      </div>

      <div className="public-site-footer-links">
        <a href="#features">Features</a>
        <a href="#workflow">How It Works</a>
        <a href="#preview">Preview</a>
        <Link to="/login">Log In</Link>
        <Link to="/signup">Sign Up</Link>
      </div>
    </footer>
  )
}

export default PublicSiteFooter
