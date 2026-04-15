import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const routeMeta = {
  '/app/dashboard': {
    title: 'Dashboard',
    description: 'Overview cards and quick project navigation.',
  },
  '/app/pos': {
    title: 'POS',
    description: 'Checkout area for sales, cart flow, and payment actions.',
  },
  '/app/inventory': {
    title: 'Inventory',
    description: 'Stock records, restocking, and inventory alerts.',
  },
  '/app/reports': {
    title: 'Reports',
    description: 'Sales summaries, exports, and sync monitoring.',
  },
  '/app/products': {
    title: 'Products',
    description: 'Catalog maintenance, API-backed product loading, and category controls.',
  },
  '/app/users': {
    title: 'Users',
    description: 'Admin-only employee assignment, branch access, and account control.',
  },
}

function Header() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { logout, user } = useAuth()
  const meta = routeMeta[pathname] || {
    title: 'Samyupsal POS',
    description: 'Expanded frontend structure is active.',
  }

  const currentUser = {
    name: user?.name || 'Admin User',
    role: user?.role || 'Administrator',
    branchName: user?.branchName || 'All Branches',
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Workspace</p>
        <h2>{meta.title}</h2>
        <p className="supporting-text">{meta.description}</p>
      </div>

      <div className="header-actions">
        <div className="user-label">
          <span className="user-label-title">Logged in as</span>
          <strong>
            {currentUser.name} ({currentUser.role})
          </strong>
          <span className="user-scope-copy">Branch: {currentUser.branchName}</span>
        </div>
        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </header>
  )
}

export default Header
