import { Link } from 'react-router-dom'
import './PublicBrand.css'

function PublicBrand({ to = '/', className = '', compact = false }) {
  const brandClassName = [
    'public-brand',
    compact ? 'public-brand--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Link to={to} className={brandClassName} aria-label="Samgyupsal POS home">
      <span className="public-brand-mark" aria-hidden="true">
        SP
      </span>

      <span className="public-brand-copy">
        <strong>Samgyupsal POS</strong>
        <span>Point-of-Sale and Inventory Monitoring System</span>
      </span>
    </Link>
  )
}

export default PublicBrand
