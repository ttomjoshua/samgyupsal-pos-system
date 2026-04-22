import { Link } from 'react-router-dom'
import './PublicBrand.css'

function PublicBrand({
  to = '/',
  className = '',
  compact = false,
  showDescription = true,
}) {
  const brandClassName = [
    'public-brand',
    compact ? 'public-brand--compact' : '',
    !showDescription ? 'public-brand--no-description' : '',
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
        {showDescription ? (
          <span>Point-of-sale and inventory monitoring system</span>
        ) : null}
      </span>
    </Link>
  )
}

export default PublicBrand
